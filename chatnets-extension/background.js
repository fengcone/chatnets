// Chatnets Background Service Worker
// 负责：接收消息、存储管理、通过 HTTP API 导出到本地文件

const STORAGE_KEY = 'chatnets_deepseek_v1';
const API_BASE_URL = 'http://127.0.0.1:8766';

// Native messaging state
let serverAvailable = false;
let serverConfig = null;

// 初始化与本地服务器的连接
async function initServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    if (response.ok) {
      const data = await response.json();
      serverAvailable = true;
      serverConfig = data;
      console.log('[Chatnets] Server connected:', data);
      return data;
    }
  } catch (error) {
    console.log('[Chatnets] Server not available:', error.message);
    serverAvailable = false;
    return null;
  }
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

// Transform extension message format to API format
function transformMessageForAPI(msg) {
  return {
    platform: msg.platform,
    session_id: msg.sessionId,
    title: msg.title || 'Chat Session',
    timestamp: msg.createdAt,
    role: msg.role,
    content: msg.content
  };
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

  // 尝试通过 HTTP API 写入本地文件
  tryHTTPWrite(messages);
}

// 尝试通过 HTTP API 写入本地文件
async function tryHTTPWrite(messages) {
  // 如果服务器还未初始化，先尝试初始化
  if (!serverAvailable && serverConfig === null) {
    await initServer();
  }

  // 如果仍然不可用，跳过
  if (!serverAvailable) {
    console.log('[Chatnets] Server not available, storing locally only');
    return;
  }

  // 逐条写入消息
  for (const msg of messages) {
    try {
      const apiMsg = transformMessageForAPI(msg);
      const response = await fetch(`${API_BASE_URL}/api/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiMsg)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Chatnets] Message written to file:', result.file_path);
      }
    } catch (error) {
      console.warn('[Chatnets] Failed to write message via HTTP:', error);
      // 标记服务器不可用，避免重复尝试
      serverAvailable = false;
      break;
    }
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
    messageCount: Object.keys(data.messages).length,
    serverAvailable: serverAvailable,
    serverConfig: serverConfig
  };
}

// 处理会话结束事件
async function handleSessionEnd(payload) {
  console.log('[Chatnets] Session end detected:', payload);
  return { success: true };
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Chatnets] Received message:', message.type);

  if (message.type === 'NEW_MESSAGES') {
    handleNewMessages(message.payload.messages).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SESSION_END') {
    handleSessionEnd(message.payload).then((result) => {
      sendResponse(result);
    }).catch((err) => {
      console.warn('[Chatnets] Session end handler failed:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
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

  if (message.type === 'INIT_SERVER') {
    initServer().then((config) => {
      sendResponse({ success: true, config: config });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'PING_SERVER') {
    fetch(`${API_BASE_URL}/api/ping`)
      .then(res => res.json())
      .then(() => {
        serverAvailable = true;
        sendResponse({ available: true });
      })
      .catch(() => {
        serverAvailable = false;
        sendResponse({ available: false });
      });
    return true;
  }

  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

// 初始化
Promise.all([initStorage(), initServer()]).then(() => {
  console.log('[Chatnets] Background service worker initialized');
  console.log('[Chatnets] Server available:', serverAvailable);
});
