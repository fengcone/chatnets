// Chatnets Content Script for DeepWiki Chat
// 负责：监听 DOM、提取消息、发送给 background

(function () {
  'use strict';

  const PLATFORM = 'deepwiki';
  const SCAN_DEBOUNCE_MS = 1000;
  let scanTimeout = null;
  let isScanning = false;

  // Storage key for sent message IDs (persistent across page reloads)
  const STORAGE_KEY = 'chatnets_dw_sent_messages_v1';
  let sentMessageIds = new Set(); // In-memory cache

  // Initialize Turndown (available globally from lib/turndown.js)
  let turndownService = null;
  if (typeof TurndownService !== 'undefined') {
    turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
  }

  // Load sent message IDs from chrome.storage
  function loadSentMessageIds() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        sentMessageIds = new Set(result[STORAGE_KEY]);
        console.log(`[Chatnets] Loaded ${sentMessageIds.size} sent message IDs from storage for DeepWiki`);
      }
    });
  }

  // Save message ID to chrome.storage
  function saveMessageId(messageId) {
    sentMessageIds.add(messageId);
    chrome.storage.local.set({ [STORAGE_KEY]: Array.from(sentMessageIds) }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Chatnets] Failed to save message ID:', chrome.runtime.lastError);
      }
    });
  }

  // Check if message was already sent
  function isMessageSent(messageId) {
    return sentMessageIds.has(messageId);
  }

  // 检查 Extension Context 是否有效
  function isExtensionContextValid() {
    try {
      return !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // 从 URL 获取 sessionId
  function getSessionId() {
    // URL pattern: https://deepwiki.com/search/<query>_<uuid>?mode=...
    const match = window.location.pathname.match(/\/search\/.*?_([a-f0-9\-]+)/i);
    return match ? match[1] : window.location.pathname;
  }

  // 获取会话标题
  function getSessionTitle() {
    // 优先尝试从页面中提取仓库名字（例如 "alibaba/OpenSandbox"）作为文件名
    // 根据 DeepWiki 页面结构，仓库名字通常在顶部的返回链接或包屑导航中
    let repoName = '';

    // 策略 1: 从 URL 中提取仓库名（最稳定）
    // URL pattern: https://deepwiki.com/search/alibaba_OpenSandbox_<uuid>
    const urlMatch = window.location.pathname.match(/\/search\/([^_]+_[^_]+)_[a-f0-9\-]+/i);
    if (urlMatch && urlMatch[1]) {
      // 将下划线替换为斜杠，还原仓库名格式
      repoName = urlMatch[1].replace(/_/g, '/');
    }

    // 策略 2: 寻找带有返回箭头特征的标签 (类似于 ← alibaba/OpenSandbox)
    if (!repoName) {
      const links = document.querySelectorAll('a, button, div.cursor-pointer, span.cursor-pointer');
      for (const el of links) {
        const text = el.innerText || '';
        // 常见特征：带有左箭头符号或直接符合 字母/字母 格式的短文本
        if ((text.includes('←') || text.includes('<-') || text.includes('back to')) && text.includes('/')) {
          const parts = text.split(/[\s←]+/).filter(p => p.includes('/'));
          if (parts.length > 0) {
            repoName = parts[0].trim();
            break;
          }
        }
      }
    }

    // 策略 3: 查找页面上所有符合 owner/repo 格式但没带箭头的显眼文本 (限制长度以防提取到长句)
    if (!repoName) {
      const possibleRepos = Array.from(document.querySelectorAll('h1, h2, h3, a, span'))
        .map(el => (el.innerText || '').trim())
        .filter(text => text.includes('/') && text.length > 3 && text.length < 50 && !text.includes(' ') && text.split('/').length === 2);

      if (possibleRepos.length > 0) {
        repoName = possibleRepos[0]; // 提取到的第一个最可能是仓库名
      }
    }

    if (repoName) {
      // 移除可能的不可见字符并返回
      return repoName.replace(/[\n\r\t]/g, '').trim();
    }

    // fallback 到页面标题
    const title = document.title.replace(' - DeepWiki', '').replace('Search | ', '').trim();
    return title || 'DeepWiki Session';
  }

  // 生成消息 ID（用于去重）
  function makeMessageId(sessionId, role, content) {
    const normalized = content.replace(/\s+/g, ' ').trim();
    const raw = `${sessionId}|${role}|${normalized}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) >>> 0;
    }
    return `${sessionId}-${role}-${hash.toString(16)}`;
  }

  // 检查是否正在生成中
  function isGenerating() {
    // 检查是否有加载的 spinner 动画
    const spinners = document.querySelectorAll('button svg.animate-spin');
    if (spinners.length > 0) {
      return true;
    }

    // 检查是否有 "Scanning" 状态文本
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.innerText && div.innerText.includes('Scanning ') && div.className.includes('animate-pulse')) {
        return true;
      }
    }

    return false;
  }

  // 提取所有消息
  function extractMessagesFromDOM() {
    // 0. 安全检查：如果插件上下文已失效，停止运行
    if (!isExtensionContextValid()) {
      console.warn('[Chatnets] Extension context invalidated. Stopping scan.');
      return;
    }

    // 1. 检查生成状态：如果正在生成中，推迟提取
    if (isGenerating()) {
      console.log('[Chatnets] AI is generating, skipping extraction...');
      scheduleExtraction(); // 继续轮询
      return;
    }

    if (isScanning) return;
    isScanning = true;

    try {
      const sessionId = getSessionId();
      const url = window.location.href;
      const title = getSessionTitle();
      const now = new Date().toISOString();

      // DeepWiki 的真实消息选择器
      // 第一轮提问是 text-xl，后续提问可能是 text-lg，但都有 w-full 类
      const userMessageNodes = document.querySelectorAll('div[data-query-display="true"] span.w-full');
      const aiMessageNodes = document.querySelectorAll('div.prose-custom');

      if (userMessageNodes.length === 0 && aiMessageNodes.length === 0) {
        return;
      }

      // Calculate starting order based on already processed messages
      const seenUserCount = Array.from(userMessageNodes).filter(m => m.dataset.chatnetsSeen === '1').length;
      const seenAiCount = Array.from(aiMessageNodes).filter(m => m.dataset.chatnetsSeen === '1').length;
      let userOrder = seenUserCount * 2;
      let aiOrder = seenAiCount * 2 + 1;

      const messages = [];

      // 处理用户消息
      userMessageNodes.forEach((node, index) => {
        if (node.dataset.chatnetsSeen === '1') return;
        node.dataset.chatnetsSeen = '1';

        const content = node.innerText || '';
        if (!content || content.length < 2) return;

        const messageId = makeMessageId(sessionId, 'user', content);

        // 使用持久化去重：检查是否已发送
        if (isMessageSent(messageId)) {
          return; // 跳过已发送的消息
        }

        messages.push({
          platform: PLATFORM,
          sessionId,
          messageId,
          role: 'user',
          content,
          createdAt: now,
          url,
          title,
          order: userOrder
        });
        userOrder += 2;
      });

      // 处理 AI 消息
      aiMessageNodes.forEach((node, index) => {
        if (node.dataset.chatnetsSeen === '1') return;
        node.dataset.chatnetsSeen = '1';

        let content = '';
        if (turndownService) {
          content = turndownService.turndown(node.innerHTML).trim();
        } else {
          content = node.innerText || '';
        }

        if (!content || content.length < 2) return;

        const messageId = makeMessageId(sessionId, 'assistant', content);

        // 使用持久化去重：检查是否已发送
        if (isMessageSent(messageId)) {
          return; // 跳过已发送的消息
        }

        messages.push({
          platform: PLATFORM,
          sessionId,
          messageId,
          role: 'assistant',
          content,
          createdAt: now,
          url,
          title,
          order: aiOrder
        });
        aiOrder += 2;
      });

      if (messages.length > 0) {
        // 按 order 排序，确保消息顺序正确
        messages.sort((a, b) => a.order - b.order);
        console.log(`[Chatnets] Extracted ${messages.length} messages, sorted by order`);

        // 保存消息 ID 到持久化存储（在发送前保存，确保不重复）
        messages.forEach(msg => saveMessageId(msg.messageId));

        // 再次检查 Context，防止异步期间失效
        if (isExtensionContextValid()) {
          try {
            chrome.runtime.sendMessage({
              type: 'NEW_MESSAGES',
              payload: { messages }
            }).catch(err => {
              // 捕获 "Extension context invalidated" 等错误
              console.warn('[Chatnets] Failed to send messages (async error):', err);
              if (err.message && err.message.includes('invalidated')) {
                console.error('[Chatnets] Extension updated. please RELOAD this page.');
              }
            });
          } catch (syncErr) {
            console.warn('[Chatnets] Failed to send messages (sync error):', syncErr);
            if (syncErr.message && syncErr.message.includes('invalidated')) {
              console.error('[Chatnets] Extension updated. please RELOAD this page.');
            }
          }
        }
      }
    } catch (err) {
      console.error('[Chatnets] Extraction error:', err);
    } finally {
      isScanning = false;
    }
  }

  // 会话活动追踪
  let lastActivityTime = Date.now();
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟
  let activityCheckInterval = null;

  function updateActivity() {
    lastActivityTime = Date.now();
  }

  // 监听用户活动
  document.addEventListener('click', updateActivity);
  document.addEventListener('keypress', updateActivity);
  document.addEventListener('scroll', updateActivity);

  // 定期检查会话是否超时
  function startSessionMonitoring() {
    if (activityCheckInterval) return;

    activityCheckInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime;

      if (inactiveTime > SESSION_TIMEOUT_MS) {
        console.log('[Chatnets] Session timeout, triggering auto-process...');
        triggerSessionEnd();
        // 重置计时器，避免重复触发
        lastActivityTime = Date.now();
      }
    }, 60000); // 每分钟检查一次
  }

  // 触发会话结束处理
  function triggerSessionEnd() {
    const sessionId = getSessionId();

    if (isExtensionContextValid()) {
      chrome.runtime.sendMessage({
        type: 'SESSION_END',
        payload: {
          platform: PLATFORM,
          sessionId: sessionId,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      }).catch(err => {
        console.warn('[Chatnets] Failed to send session end:', err);
      });
    }
  }

  // 防抖扫描
  function scheduleExtraction() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(extractMessagesFromDOM, SCAN_DEBOUNCE_MS);
  }

  // 设置 MutationObserver
  function setupObserver() {
    let attempts = 0;
    const maxAttempts = 20;

    const waitForContainer = setInterval(() => {
      if (!isExtensionContextValid()) {
        clearInterval(waitForContainer);
        return;
      }

      attempts++;
      // DeepWiki主要内容在主容器
      let chatContainer = document.querySelector('main') || document.querySelector('#__next') || document.body;

      if (chatContainer) {
        clearInterval(waitForContainer);
        console.log('[Chatnets] Chat container found, starting observer.');

        // 初始扫描
        setTimeout(extractMessagesFromDOM, 1000);

        // 监听 DOM 变化
        const observer = new MutationObserver((mutations) => {
          if (!isExtensionContextValid()) {
            observer.disconnect();
            return;
          }
          let hasNewContent = false;
          for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
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
          subtree: true,
          characterData: true
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(waitForContainer);
        console.warn('[Chatnets] Failed to find chat container.');
      }
    }, 500);
  }

  // 监听 URL 变化
  let lastUrl = window.location.href;
  let urlCheckInterval = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[Chatnets] URL changed, rescanning...');
      document.querySelectorAll('[data-chatnets-seen]').forEach(node => {
        node.removeAttribute('data-chatnets-seen');
      });
      setTimeout(extractMessagesFromDOM, 1000);
    }
  }, 1000); // 简单的 URL 轮询

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObserver);
  } else {
    setupObserver();
  }

  // 页面卸载/隐藏时触发 - 更可靠的方式
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

  // 使用 pagehide 比 beforeunload 更可靠
  window.addEventListener('pagehide', notifySessionEnd);
  window.addEventListener('beforeunload', notifySessionEnd);

  // 定期心跳检测
  let heartbeatInterval = null;

  function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    // 每 30 秒检查一次
    heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityTime;

      // 如果 5 分钟没有活动，触发 session end
      if (inactiveTime > 5 * 60 * 1000) {
        console.log('[Chatnets] No activity detected for 5 minutes, triggering session end');
        notifySessionEnd();
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }, 30 * 1000);
  }

  // 启动心跳检测
  startHeartbeat();

  // 启动监控
  startSessionMonitoring();

  // 监听来自 sidebar 的 GET_SESSION_INFO 请求
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SESSION_INFO') {
      const sessionId = getSessionId();
      const title = getSessionTitle();
      const userMessageNodes = document.querySelectorAll('div[data-query-display="true"] span.text-xl');
      const aiMessageNodes = document.querySelectorAll('div.prose-custom');
      const messageCount = userMessageNodes.length + aiMessageNodes.length;

      sendResponse({
        id: sessionId,
        title: title,
        messageCount: messageCount,
        platform: PLATFORM,
        url: window.location.href
      });
    }
  });

  // Initialize: load sent message IDs from storage
  loadSentMessageIds();

  console.log('[Chatnets] Content script loaded on DeepWiki');
})();
