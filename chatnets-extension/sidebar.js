// Chatnets Sidebar - Session Management UI
// Shows current session and pending sessions with manual trigger buttons

const SERVER_URL = 'http://localhost:8765/api/v1';

const state = {
  currentSession: null,
  pendingSessions: [],
  processing: new Set()
};

/**
 * Check if the server is reachable
 */
async function checkConnection() {
  try {
    const res = await fetch('http://localhost:8765/');
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get current session info from the active tab
 */
async function getCurrentSession() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url || !tab.url.includes('deepseek.com')) return null;

  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'GET_SESSION_INFO' });
  } catch {
    return null;
  }
}

/**
 * Fetch pending sessions from the server
 */
async function fetchPendingSessions() {
  try {
    const res = await fetch(`${SERVER_URL}/ingest/sessions/pending`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (err) {
    return [];
  }
}

/**
 * Process a session - send pending messages to AI pipeline
 */
async function processSession(sessionId) {
  if (state.processing.has(sessionId)) return;

  state.processing.add(sessionId);
  render();

  try {
    // Get all pending messages
    const pendingRes = await fetch(`${SERVER_URL}/ingest/pending?limit=200`);
    const pendingData = await pendingRes.json();

    // Filter messages for this session
    const sessionMessages = pendingData.messages.filter(m => m.session_id === sessionId);

    if (sessionMessages.length === 0) {
      alert('该会话没有待处理的消息');
      state.processing.delete(sessionId);
      render();
      return;
    }

    const messageIds = sessionMessages.map(m => m.id);

    // Process messages
    const res = await fetch(`${SERVER_URL}/ingest/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: messageIds })
    });

    const result = await res.json();

    // Clear processing state after a delay
    setTimeout(() => {
      state.processing.delete(sessionId);
      render();
    }, 3000);

    // Reload pending sessions
    loadPendingSessions();
  } catch (err) {
    console.error('Process session error:', err);
    state.processing.delete(sessionId);
    render();
  }
}

/**
 * Format timestamp to relative time
 */
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return date.toLocaleDateString();
}

/**
 * Render the sidebar UI
 */
async function render() {
  const statusDot = document.getElementById('statusDot');
  const content = document.getElementById('content');

  const connected = await checkConnection();
  statusDot.classList.toggle('disconnected', !connected);

  let html = '';

  // Current session section
  if (state.currentSession) {
    const isProcessing = state.processing.has(state.currentSession.id);
    html += `
      <div class="section">
        <div class="section-title">当前会话</div>
        <div class="session-card">
          <div class="session-title">${state.currentSession.title || 'DeepSeek Chat'}</div>
          <div class="session-meta">${state.currentSession.messageCount || 0} 条消息 • 刚刚</div>
          ${isProcessing
            ? '<button class="btn btn-primary" disabled><div class="loading-spinner"></div> 整理中...</button>'
            : '<button class="btn btn-primary" onclick="window.processSession(\'' + state.currentSession.id + '\')">整理到图谱</button>'
          }
        </div>
      </div>
    `;
  }

  // Pending sessions section
  if (state.pendingSessions.length > 0) {
    html += '<div class="section"><div class="section-title">历史会话 (未整理)</div>';
    state.pendingSessions.slice(0, 5).forEach(session => {
      const isProcessing = state.processing.has(session.id);
      html += `
        <div class="session-card">
          <div class="session-title">${session.title || 'Session'}</div>
          <div class="session-meta">${session.messageCount || 0} 条 • ${formatTime(session.updatedAt)}</div>
          ${isProcessing
            ? '<button class="btn btn-secondary" disabled><div class="loading-spinner"></div> 整理中...</button>'
            : '<button class="btn btn-secondary" onclick="window.processSession(\'' + session.id + '\')">整理到图谱</button>'
          }
        </div>
      `;
    });
    html += '</div>';
  } else if (!state.currentSession) {
    html += '<div class="empty-state">暂无待处理会话<br><br>在 DeepSeek 聊天后，这里会显示待整理的内容</div>';
  }

  content.innerHTML = html;
}

/**
 * Load pending sessions from server
 */
async function loadPendingSessions() {
  state.pendingSessions = await fetchPendingSessions();
  render();
}

/**
 * Initialize the sidebar
 */
async function init() {
  // Show initial state
  render();

  // Load current session
  state.currentSession = await getCurrentSession();

  // Load pending sessions
  await loadPendingSessions();

  // Refresh every 10 seconds
  setInterval(async () => {
    state.currentSession = await getCurrentSession();
    await loadPendingSessions();
  }, 10000);
}

// Expose processSession to global scope for onclick handlers
window.processSession = processSession;

// Start
init();
