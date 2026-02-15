// Chatnets Popup Script

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8765';

// 显示状态消息
function showSaveStatus(message, type = 'success') {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 2000);
}

// 更新连接状态
function updateConnectionStatus(status, text) {
  const dot = document.getElementById('status-dot');
  const textEl = document.getElementById('connection-text');

  dot.className = `status-dot ${status}`;
  textEl.textContent = text;
}

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.local.get(['serverUrl']);
  const serverUrl = result.serverUrl || DEFAULT_SERVER_URL;
  document.getElementById('server-url').value = serverUrl;
  return serverUrl;
}

// 保存设置
async function saveSettings() {
  const serverUrl = document.getElementById('server-url').value.trim() || DEFAULT_SERVER_URL;

  await chrome.storage.local.set({ serverUrl });
  showSaveStatus('设置已保存', 'success');

  // Notify background to reload server URL
  chrome.runtime.sendMessage({ type: 'RELOAD_CONFIG' });

  // Check connection after saving
  setTimeout(checkConnection, 500);
}

// 检查连接
async function checkConnection() {
  const serverUrl = document.getElementById('server-url').value.trim() || DEFAULT_SERVER_URL;
  updateConnectionStatus('checking', '检查中...');

  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      cache: 'no-store'
    });

    if (response.ok) {
      updateConnectionStatus('connected', '已连接');
    } else {
      updateConnectionStatus('disconnected', '连接失败');
    }
  } catch (error) {
    updateConnectionStatus('disconnected', '未连接');
  }
}

// 更新统计数据
async function updateStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    document.getElementById('session-count').textContent = response.sessionCount || 0;
    document.getElementById('message-count').textContent = response.messageCount || 0;
  } catch (error) {
    console.error('[Chatnets] Failed to get stats:', error);
    document.getElementById('session-count').textContent = '?';
    document.getElementById('message-count').textContent = '?';
  }
}

// 导出所有数据
async function exportAllData() {
  try {
    showSaveStatus('正在导出...', 'info');
    await chrome.runtime.sendMessage({ type: 'EXPORT_ALL' });
    showSaveStatus('导出成功！', 'success');
  } catch (error) {
    console.error('[Chatnets] Export failed:', error);
    showSaveStatus('导出失败', 'info');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await updateStats();
  await checkConnection();
});

// 事件监听
document.getElementById('save-settings').addEventListener('click', saveSettings);
document.getElementById('export-all').addEventListener('click', exportAllData);
document.getElementById('refresh-stats').addEventListener('click', updateStats);
