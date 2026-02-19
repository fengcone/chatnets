// Chatnets Popup Script

const API_BASE_URL = 'http://127.0.0.1:8766';

// 显示状态消息
function showActionStatus(message, type = 'success') {
  const statusEl = document.getElementById('action-status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// 更新连接状态
function updateServerStatus(status, text) {
  const dot = document.getElementById('native-status-dot');
  const textEl = document.getElementById('native-status-text');

  dot.className = `status-dot ${status}`;
  textEl.textContent = text;
}

// 检查服务器连接
async function checkServer() {
  updateServerStatus('checking', '检查中...');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'PING_SERVER' });

    if (response && response.available) {
      updateServerStatus('connected', '已连接');
      await loadServerConfig();
    } else {
      updateServerStatus('disconnected', '未连接');
      document.getElementById('save-directory-section').style.display = 'none';
    }
  } catch (error) {
    console.error('[Chatnets] Failed to check server:', error);
    updateServerStatus('disconnected', '连接失败');
    document.getElementById('save-directory-section').style.display = 'none';
  }
}

// 加载服务器配置
async function loadServerConfig() {
  try {
    const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (stats.serverAvailable && stats.serverConfig) {
      const config = stats.serverConfig;

      // 显示保存目录
      document.getElementById('save-directory').textContent =
        config.save_directory || '未知';

      // 显示平台信息
      const platforms = [];
      if (config.platforms) {
        for (const [name, p] of Object.entries(config.platforms)) {
          if (p.enabled) platforms.push(name);
        }
      }
      document.getElementById('platform-info').textContent =
        `支持平台: ${platforms.join(', ') || '无'}`;

      document.getElementById('save-directory-section').style.display = 'block';
    } else {
      document.getElementById('save-directory-section').style.display = 'none';
    }
  } catch (error) {
    console.error('[Chatnets] Failed to load server config:', error);
  }
}

// 初始化服务器连接
async function initServer() {
  showActionStatus('正在连接...', 'info');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'INIT_SERVER' });

    if (response.success) {
      showActionStatus('连接成功！', 'success');
      await checkServer();
    } else {
      showActionStatus('连接失败，请确保 chatnets-native 正在运行', 'error');
      updateServerStatus('disconnected', '连接失败');
    }
  } catch (error) {
    console.error('[Chatnets] Failed to init server:', error);
    showActionStatus('请先启动 chatnets-native 程序', 'error');
    updateServerStatus('disconnected', '未启动');
  }
}

// 更新统计数据
async function updateStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    document.getElementById('session-count').textContent = response.sessionCount || 0;
    document.getElementById('message-count').textContent = response.messageCount || 0;

    // 如果服务器可用，更新配置显示
    if (response.serverAvailable) {
      await loadServerConfig();
    }
  } catch (error) {
    console.error('[Chatnets] Failed to get stats:', error);
    document.getElementById('session-count').textContent = '?';
    document.getElementById('message-count').textContent = '?';
  }
}

// 导出所有数据
async function exportAllData() {
  try {
    showActionStatus('正在导出...', 'info');
    await chrome.runtime.sendMessage({ type: 'EXPORT_ALL' });
    showActionStatus('导出成功！', 'success');
  } catch (error) {
    console.error('[Chatnets] Export failed:', error);
    showActionStatus('导出失败', 'error');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await updateStats();
  await checkServer();
});

// 事件监听
document.getElementById('export-all').addEventListener('click', exportAllData);
document.getElementById('refresh-stats').addEventListener('click', updateStats);
document.getElementById('check-native').addEventListener('click', checkServer);
document.getElementById('init-native').addEventListener('click', initServer);
