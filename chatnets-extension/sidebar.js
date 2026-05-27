// Chatnets Sidebar
// Reflects the currently supported 8766 backend and active conversation state.

const SUPPORTED_HOSTS = ['chat.deepseek.com', 'chat.openai.com', 'chatgpt.com', 'deepwiki.com'];

const state = {
  currentSession: null,
  serverAvailable: false,
  serverConfig: null,
  stats: null,
  activeTabUrl: '',
  supportedPage: false,
  loading: true
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPlatform(platform) {
  if (!platform) return '未知平台';

  const labels = {
    deepseek: 'DeepSeek',
    chatgpt: 'ChatGPT',
    deepwiki: 'DeepWiki'
  };

  return labels[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

function formatPlatforms(platforms) {
  if (!platforms) return '无';

  return Object.entries(platforms)
    .filter(([, config]) => config && config.enabled)
    .map(([name]) => formatPlatform(name))
    .join(' / ') || '无';
}

function isSupportedUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return SUPPORTED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function getStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  state.stats = stats;
  state.serverAvailable = !!stats.serverAvailable;
  state.serverConfig = stats.serverConfig || null;
}

async function pingServer() {
  const response = await chrome.runtime.sendMessage({ type: 'PING_SERVER' });
  state.serverAvailable = !!(response && response.available);

  if (!state.serverAvailable) {
    state.serverConfig = null;
  } else if (!state.serverConfig) {
    await getStats();
  }
}

async function reconnectServer() {
  await chrome.runtime.sendMessage({ type: 'INIT_SERVER' });
  await refreshState();
}

async function getCurrentSession() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.activeTabUrl = tab?.url || '';
  state.supportedPage = isSupportedUrl(state.activeTabUrl);

  if (!tab?.id || !state.supportedPage) {
    state.currentSession = null;
    return;
  }

  try {
    state.currentSession = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SESSION_INFO' });
  } catch {
    state.currentSession = null;
  }
}

function renderServerSection() {
  const statusText = state.serverAvailable ? '已连接 127.0.0.1:8766' : '未连接 127.0.0.1:8766';
  const saveDirectory = state.serverConfig?.save_directory
    ? `<div class="path">${escapeHtml(state.serverConfig.save_directory)}</div>`
    : '';

  return `
    <div class="section">
      <div class="section-title">本地服务</div>
      <div class="card">
        <div class="title">${statusText}</div>
        <div class="meta">当前扩展会把消息同步到 Go 本地服务；服务不可用时只保存在浏览器本地。</div>
        ${saveDirectory}
        <div class="hint">启用平台: ${escapeHtml(formatPlatforms(state.serverConfig?.platforms))}</div>
      </div>
    </div>
  `;
}

function renderStatsSection() {
  const sessionCount = state.stats?.sessionCount ?? '-';
  const messageCount = state.stats?.messageCount ?? '-';

  return `
    <div class="section">
      <div class="section-title">本地缓存</div>
      <div class="grid">
        <div class="stat">
          <span class="stat-label">会话数</span>
          <span class="stat-value">${escapeHtml(sessionCount)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">消息数</span>
          <span class="stat-value">${escapeHtml(messageCount)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderSessionSection() {
  if (state.currentSession) {
    return `
      <div class="section">
        <div class="section-title">当前会话</div>
        <div class="card">
          <div class="title">${escapeHtml(state.currentSession.title || 'Untitled Session')}</div>
          <div class="meta">${escapeHtml(formatPlatform(state.currentSession.platform))} · ${escapeHtml(state.currentSession.messageCount || 0)} 条消息</div>
          <div class="hint">Session ID: ${escapeHtml(state.currentSession.id || '')}</div>
        </div>
      </div>
    `;
  }

  if (state.supportedPage) {
    return `
      <div class="section">
        <div class="section-title">当前会话</div>
        <div class="card">
          <div class="title">页面已识别</div>
          <div class="meta">当前标签页属于受支持平台，但还没有读取到会话内容。通常刷新页面或等待内容脚本完成初始化即可。</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <div class="section-title">当前会话</div>
      <div class="empty-state">当前标签页不是受支持的聊天页面。<br>支持 DeepSeek、ChatGPT 和 DeepWiki。</div>
    </div>
  `;
}

function renderActions() {
  return `
    <div class="section">
      <div class="actions">
        <button class="btn btn-primary" id="refresh-btn">刷新状态</button>
        <button class="btn btn-secondary" id="reconnect-btn">重新连接</button>
      </div>
    </div>
  `;
}

function render() {
  const statusDot = document.getElementById('statusDot');
  const content = document.getElementById('content');

  statusDot.classList.toggle('disconnected', !state.serverAvailable);
  statusDot.classList.toggle('checking', state.loading);

  if (state.loading) {
    content.innerHTML = '<div class="empty-state">正在同步扩展状态...</div>';
    return;
  }

  content.innerHTML = [
    renderServerSection(),
    renderStatsSection(),
    renderSessionSection(),
    renderActions()
  ].join('');

  document.getElementById('refresh-btn').addEventListener('click', refreshState);
  document.getElementById('reconnect-btn').addEventListener('click', reconnectServer);
}

async function refreshState() {
  state.loading = true;
  render();

  try {
    await pingServer();
    await getStats();
    await getCurrentSession();
  } catch (error) {
    console.error('[Chatnets] Sidebar refresh failed:', error);
  } finally {
    state.loading = false;
    render();
  }
}

async function init() {
  await refreshState();
  setInterval(refreshState, 10000);
}

init();
