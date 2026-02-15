// Chatnets Content Script for DeepSeek Chat
// 负责：监听 DOM、提取消息、发送给 background

(function () {
  'use strict';

  const PLATFORM = 'deepseek';
  const SCAN_DEBOUNCE_MS = 1000;
  let scanTimeout = null;
  let isScanning = false;

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
    const match = window.location.pathname.match(/\/a\/chat\/s\/([^/]+)/);
    return match ? match[1] : window.location.pathname;
  }

  // 获取会话标题
  function getSessionTitle() {
    // 尝试从页面标题获取
    const title = document.title.replace(' - DeepSeek', '').trim();
    return title || 'DeepSeek Chat';
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

  // 清理消息文本
  function cleanMessageText(text) {
    return text
      .replace(/本回答由 AI 生成，内容仅供参考，请仔细甄别。/g, '')
      .replace(/复制下载/g, '')
      .trim();
  }

  // 检查是否正在生成中
  function isGenerating() {
    // 查找输入框右下角的按钮
    // 生成中状态：图标通常是正方形 (Stop)
    // 空闲状态：图标通常是向上箭头 (Send)

    // 策略：检查所有 role="button" 的 SVG path
    const buttons = document.querySelectorAll('div[role="button"]');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg) {
        const path = svg.querySelector('path');
        if (path) {
          const d = path.getAttribute('d') || '';
          // "Stop" 图标特征：正方形，路径通常以 M2 或 M? 开头，且比较简单
          // DeepSeek 的 Stop 图标是圆角正方形，path d 属性通常包含 "2 4.88"
          if (d.startsWith('M2 4.88') || d.includes('M2 4.88')) {
            return true;
          }
        }
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

      // DeepSeek 的真实消息选择器
      const userMessages = document.querySelectorAll('div.fbb737a4');
      const aiMessages = document.querySelectorAll('div.ds-message');

      if (userMessages.length === 0 && aiMessages.length === 0) {
        return;
      }

      // Calculate starting order based on already processed messages
      const seenUserCount = Array.from(userMessages).filter(m => m.dataset.chatnetsSeen === '1').length;
      const seenAiCount = Array.from(aiMessages).filter(m => m.dataset.chatnetsSeen === '1').length;
      let userOrder = seenUserCount * 2;
      let aiOrder = seenAiCount * 2 + 1;

      const messages = [];

      // 处理用户消息
      userMessages.forEach((node, index) => {
        if (node.dataset.chatnetsSeen === '1') return;
        node.dataset.chatnetsSeen = '1';

        const content = cleanMessageText(node.innerText || '');
        if (!content || content.length < 2) return;

        const messageId = makeMessageId(sessionId, 'user', content);
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
      // 注意：排除包含用户消息的节点，避免重复
      aiMessages.forEach((node, index) => {
        if (node.dataset.chatnetsSeen === '1') return;

        // 如果这个 ds-message 节点内部包含用户消息类 (fbb737a4)，跳过
        if (node.querySelector('.fbb737a4')) {
          node.dataset.chatnetsSeen = '1';
          return;
        }

        // 如果这个节点本身就是用户消息容器的一部分，跳过
        if (node.closest('.fbb737a4')) {
          node.dataset.chatnetsSeen = '1';
          return;
        }

        node.dataset.chatnetsSeen = '1';

        const content = cleanMessageText(node.innerText || '');
        if (!content || content.length < 2) return;

        const messageId = makeMessageId(sessionId, 'assistant', content);
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
        console.log(`[Chatnets] Extracted ${messages.length} messages`);

        // 再次检查 Context，防止异步期间失效
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
      let chatContainer = document.querySelector('[role="main"]') || document.body;

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

  // 监听 URL 变化
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

  // 保留 beforeunload 作为备用
  window.addEventListener('beforeunload', notifySessionEnd);

  // 定期心跳检测 - 如果长时间没有活动，触发 session end
  // 注意：lastActivityTime 已在 startSessionMonitoring 中声明，这里复用
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

  // 监听用户活动
  ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
    document.addEventListener(event, () => {
      lastActivityTime = Date.now();
    }, true);
  });

  // 启动心跳检测
  startHeartbeat();

  // 启动监控
  startSessionMonitoring();

  // 监听来自 sidebar 的 GET_SESSION_INFO 请求
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SESSION_INFO') {
      const sessionId = getSessionId();
      const title = getSessionTitle();
      const userMessages = document.querySelectorAll('div.fbb737a4');
      const aiMessages = document.querySelectorAll('div.ds-message');
      const messageCount = userMessages.length + aiMessages.length;

      sendResponse({
        id: sessionId,
        title: title,
        messageCount: messageCount,
        platform: PLATFORM,
        url: window.location.href
      });
    }
  });

  console.log('[Chatnets] Content script loaded on DeepSeek');
})();
