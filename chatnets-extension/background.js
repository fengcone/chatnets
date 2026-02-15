// Chatnets Background Service Worker
// 负责：接收消息、存储管理、导出数据、与本地服务通信

const STORAGE_KEY = 'chatnets_deepseek_v1';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8765';
let serverUrl = DEFAULT_SERVER_URL;

// Load server URL from storage
async function loadServerUrl() {
  const result = await chrome.storage.local.get(['serverUrl']);
  if (result.serverUrl) {
    serverUrl = result.serverUrl;
    console.log('[Chatnets] Server URL loaded:', serverUrl);
  }
}

// Transform extension message format to backend API format
// Extension uses camelCase (sessionId, messageId, createdAt, order)
// Backend expects snake_case (session_id, id, created_at, order_in_session)
function transformMessageForAPI(msg) {
  return {
    id: msg.messageId,
    session_id: msg.sessionId,
    role: msg.role, // Already 'user' or 'assistant'
    content: msg.content,
    created_at: msg.createdAt,
    order_in_session: msg.order,
    url: msg.url,
    title: msg.title,
    process_status: 'pending'
  };
}

// 初始化存储结构
async function initStorage() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (!data[STORAGE_KEY]) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        sessions: {},
        messages: {}
      }
    });
  }
}

// 处理新消息
async function handleNewMessages(messages) {
  const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {
    sessions: {},
    messages: {}
  };

  for (const msg of messages) {
    // 创建或更新 session
    if (!data.sessions[msg.sessionId]) {
      data.sessions[msg.sessionId] = {
        platform: msg.platform,
        sessionId: msg.sessionId,
        title: msg.title || 'DeepSeek Session',
        url: msg.url,
        startedAt: msg.createdAt
      };
    }

    // 消息去重
    if (!data.messages[msg.messageId]) {
      data.messages[msg.messageId] = msg;
      console.log('[Chatnets] New message stored:', msg.messageId);
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: data });

  // 尝试同步到本地服务（如果可用）
  trySync(messages);
}

// 尝试同步到本地服务
async function trySync(messages) {
  try {
    // Transform messages to backend API format before sending
    const apiMessages = messages.map(transformMessageForAPI);

    const response = await fetch(`${serverUrl}/api/v1/ingest/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'deepseek', messages: apiMessages })
    });

    if (response.ok) {
      console.log('[Chatnets] Synced to local server');
    }
  } catch (error) {
    // 本地服务不可用，仅存储在浏览器中
    console.log('[Chatnets] Local server not available, stored locally only');
  }
}

// 导出所有数据为 JSON 文件
async function exportAllData() {
  const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {
    sessions: {},
    messages: {}
  };

  const exportData = {
    exportedAt: new Date().toISOString(),
    platform: 'deepseek',
    sessions: Object.values(data.sessions),
    messages: Object.values(data.messages)
  };

  try {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    // Service Worker 中 URL.createObjectURL 可能受限，尝试使用 Reader 转换 DataURL
    const reader = new FileReader();
    reader.onload = function () {
      chrome.downloads.download({
        url: this.result,
        filename: `chatnets-deepseek-${new Date().toISOString().slice(0, 10)}.json`,
        saveAs: true
      });
    };
    reader.readAsDataURL(blob);

  } catch (err) {
    console.error('[Chatnets] Export failed:', err);
  }
}

// 获取统计信息
async function getStats() {
  const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {
    sessions: {},
    messages: {}
  };

  return {
    sessionCount: Object.keys(data.sessions).length,
    messageCount: Object.keys(data.messages).length
  };
}

// 处理会话结束事件 - 触发 AI pipeline 处理
async function handleSessionEnd(payload) {
  console.log('[Chatnets] Session end detected:', payload);

  // Trigger pipeline on backend server
  try {
    const response = await fetch(`${serverUrl}/api/v1/pipeline/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: payload.sessionId,
        trigger_by: payload.trigger || 'auto_session_end'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Chatnets] Pipeline triggered:', result);
      return result;
    } else {
      console.warn('[Chatnets] Pipeline trigger failed:', response.status);
    }
  } catch (error) {
    // 本地服务不可用，静默忽略
    console.log('[Chatnets] Local server not available for pipeline trigger');
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Chatnets] Received message:', message.type);

  if (message.type === 'NEW_MESSAGES') {
    handleNewMessages(message.payload.messages).then(() => {
      sendResponse({ success: true });
    });
    return true; // 异步响应
  }

  if (message.type === 'SESSION_END') {
    handleSessionEnd(message.payload).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      console.warn('[Chatnets] Session end handler failed:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // 异步响应
  }

  if (message.type === 'EXPORT_ALL') {
    exportAllData().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_STATS') {
    getStats().then((stats) => {
      sendResponse(stats);
    });
    return true;
  }

  if (message.type === 'RELOAD_CONFIG') {
    loadServerUrl().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

// 初始化
Promise.all([initStorage(), loadServerUrl()]).then(() => {
  console.log('[Chatnets] Background service worker initialized');
});
