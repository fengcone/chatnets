// Chatnets Content Script for ChatGPT
// Based on DeepSeek script, adapted for ChatGPT DOM structure

(function () {
  'use strict';

  const PLATFORM = 'chatgpt';
  const SCAN_DEBOUNCE_MS = 1000;
  let scanTimeout = null;
  let isScanning = false;

  // Initialize Turndown (available globally from lib/turndown.js)
  let turndownService = null;
  if (typeof TurndownService !== 'undefined') {
    turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
  }

  function isExtensionContextValid() {
    try {
      return !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // ChatGPT uses /c/{conversation_id} in URL
  function getSessionId() {
    const match = window.location.pathname.match(/\/c\/([a-z0-9-]{36})/);
    return match ? match[1] : window.location.pathname;
  }

  function getSessionTitle() {
    const title = document.title.replace(' - ChatGPT', '').trim();
    return title || 'ChatGPT Conversation';
  }

  function makeMessageId(sessionId, role, content) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    const raw = `${sessionId}|${role}|${normalized}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) >>> 0;
    }
    return `${sessionId}-${role}-${hash.toString(16)}`;
  }

  function cleanMessageText(text) {
    return text
      .replace(/\[.\]+\]/g, '') // Remove [footnote] citations
      .trim();
  }

  function isGenerating() {
    // ChatGPT has a specific loading indicator
    const loadingIndicator = document.querySelector('[data-testid="loading-indicator"]');
    return loadingIndicator && loadingIndicator.style.display !== 'none';
  }

  function extractMessagesFromDOM() {
    if (!isExtensionContextValid()) {
      console.warn('[Chatnets] Extension context invalidated. Stopping scan.');
      return;
    }

    if (isGenerating()) {
      console.log('[Chatnets] AI is generating, skipping extraction...');
      scheduleExtraction();
      return;
    }

    if (isScanning) return;
    isScanning = true;

    try {
      const sessionId = getSessionId();
      const url = window.location.href;
      const title = getSessionTitle();
      const now = new Date().toISOString();

      // ChatGPT DOM structure - messages have data-message-author-role attribute
      const messageNodes = document.querySelectorAll('[data-message-author-role]');

      if (messageNodes.length === 0) {
        isScanning = false;
        return;
      }

      // Calculate starting order based on already processed messages
      const seenUserCount = Array.from(messageNodes).filter(
        m => m.dataset.chatnetsSeen === '1' && m.getAttribute('data-message-author-role') === 'user'
      ).length;
      const seenAiCount = Array.from(messageNodes).filter(
        m => m.dataset.chatnetsSeen === '1' && m.getAttribute('data-message-author-role') === 'assistant'
      ).length;
      let userOrder = seenUserCount * 2;
      let aiOrder = seenAiCount * 2 + 1;

      const messages = [];

      messageNodes.forEach((node) => {
        if (node.dataset.chatnetsSeen === '1') return;

        const role = node.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') return;

        // Get message content
        const markdownNode = node.querySelector('.markdown');
        const contentNode = markdownNode || node.querySelector('[data-message-author-role]') || node;

        let content = '';
        if (role === 'assistant' && turndownService && markdownNode) {
          // Clean up unwanted copy buttons etc. if they exist inside markdown node
          const clone = markdownNode.cloneNode(true);
          const copyBtns = clone.querySelectorAll('button');
          copyBtns.forEach(btn => btn.remove());

          content = turndownService.turndown(clone.innerHTML).trim();
        } else {
          content = cleanMessageText(contentNode.innerText || '');
        }
        if (!content || content.length < 2) return;

        node.dataset.chatnetsSeen = '1';

        const messageId = makeMessageId(sessionId, role, content);
        const order = role === 'user' ? userOrder : aiOrder;

        messages.push({
          platform: PLATFORM,
          sessionId,
          messageId,
          role: role,
          content,
          createdAt: now,
          url,
          title,
          order
        });

        if (role === 'user') userOrder += 2;
        else aiOrder += 2;
      });

      if (messages.length > 0) {
        console.log(`[Chatnets] Extracted ${messages.length} messages`);

        if (isExtensionContextValid()) {
          try {
            chrome.runtime.sendMessage({
              type: 'NEW_MESSAGES',
              payload: { messages }
            }).catch(err => {
              console.warn('[Chatnets] Failed to send messages:', err);
            });
          } catch (syncErr) {
            console.warn('[Chatnets] Failed to send messages:', syncErr);
          }
        }
      }
    } catch (err) {
      console.error('[Chatnets] Extraction error:', err);
    } finally {
      isScanning = false;
    }
  }

  function scheduleExtraction() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(extractMessagesFromDOM, SCAN_DEBOUNCE_MS);
  }

  function setupObserver() {
    let attempts = 0;
    const maxAttempts = 20;

    const waitForContainer = setInterval(() => {
      if (!isExtensionContextValid()) {
        clearInterval(waitForContainer);
        return;
      }

      attempts++;
      const chatContainer = document.querySelector('main') || document.body;

      if (chatContainer) {
        clearInterval(waitForContainer);
        console.log('[Chatnets] ChatGPT container found, starting observer.');

        setTimeout(extractMessagesFromDOM, 1000);

        const observer = new MutationObserver((mutations) => {
          if (!isExtensionContextValid()) {
            observer.disconnect();
            return;
          }
          let hasNewContent = false;
          for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
              hasNewContent = true;
              break;
            }
          }
          if (hasNewContent) {
            scheduleExtraction();
          }
        });

        observer.observe(chatContainer, {
          childList: true,
          subtree: true
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(waitForContainer);
        console.warn('[Chatnets] Failed to find chat container.');
      }
    }, 500);
  }

  // Monitor URL changes
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[Chatnets] URL changed, rescanning...');
      document.querySelectorAll('[data-chatnets-seen]').forEach(node => {
        node.removeAttribute('data-chatnets-seen');
      });
      setTimeout(extractMessagesFromDOM, 1000);
    }
  });

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver);
  } else {
    setupObserver();
  }

  // Session activity tracking and end detection
  let lastActivityTime = Date.now();
  let heartbeatInterval = null;

  function notifySessionEnd() {
    const sessionId = getSessionId();
    try {
      chrome.runtime.sendMessage({
        type: 'SESSION_END',
        payload: { platform: PLATFORM, sessionId: sessionId }
      });
    } catch (e) {
      // ignore
    }
  }

  // Use pagehide instead of beforeunload (more reliable)
  window.addEventListener('pagehide', notifySessionEnd);
  window.addEventListener('beforeunload', notifySessionEnd);

  // Heartbeat detection - trigger session end after 5 minutes of inactivity
  function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityTime;

      if (inactiveTime > 5 * 60 * 1000) {
        console.log('[Chatnets] No activity detected for 5 minutes, triggering session end');
        notifySessionEnd();
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }, 30 * 1000);
  }

  document.addEventListener('click', () => {
    lastActivityTime = Date.now();
  });
  document.addEventListener('keypress', () => {
    lastActivityTime = Date.now();
  });
  document.addEventListener('scroll', () => {
    lastActivityTime = Date.now();
  });

  startHeartbeat();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SESSION_INFO') {
      const sessionId = getSessionId();
      const title = getSessionTitle();
      const messageCount = document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]').length;

      sendResponse({
        id: sessionId,
        title: title,
        messageCount: messageCount,
        platform: PLATFORM,
        url: window.location.href
      });
    }
  });

  console.log('[Chatnets] Content script loaded on ChatGPT');
})();
