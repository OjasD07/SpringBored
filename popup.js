// SpringBored - Popup Script

const btnStart  = document.getElementById('btnStart');
const btnPause  = document.getElementById('btnPause');
const btnStop   = document.getElementById('btnStop');
const statusDot  = document.getElementById('statusDot');
const statusCard = document.getElementById('statusCard');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progCount  = document.getElementById('progCount');
const skipCount  = document.getElementById('skipCount');
const doneCount  = document.getElementById('doneCount');
const logFeed    = document.getElementById('logFeed');
const clearLogBtn = document.getElementById('clearLog');

let isPaused = false;

// ── Status icons ─────────────────────────────────────────────────────────────
const ICONS = {
  idle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  running: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  paused: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  done: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>`,
};

// ── Apply status state to UI ──────────────────────────────────────────────────
function applyStatus(state, message, data = {}) {
  statusDot.className  = `status-dot ${state}`;
  statusCard.className = `status-card ${state}`;
  statusIcon.innerHTML = ICONS[state] || ICONS.idle;
  statusText.textContent = message;

  const isActive = state === 'running' || state === 'paused';
  btnStart.disabled = isActive;
  btnPause.disabled = !isActive;
  btnStop.disabled  = !isActive;

  if (state === 'paused') {
    btnPause.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume`;
  } else {
    btnPause.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause`;
  }

  if (data.total > 0) {
    progressSection.style.display = 'flex';
    const pct = Math.round((data.completed / data.total) * 100);
    progressFill.style.width = pct + '%';
    progCount.textContent   = `${data.completed} / ${data.total}`;
    doneCount.textContent   = data.completed;
    skipCount.textContent   = data.skipped ?? 0;
  }
}

// ── Add entry to log feed ─────────────────────────────────────────────────────
function addLog(text, type = 'running') {
  // Remove initial idle placeholder
  const idle = logFeed.querySelector('.idle');
  if (idle) idle.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logFeed.appendChild(entry);
  logFeed.scrollTop = logFeed.scrollHeight;

  // Keep max 60 entries
  while (logFeed.children.length > 60) {
    logFeed.removeChild(logFeed.firstChild);
  }
}

// ── Send action to active tab's content script ────────────────────────────────
async function sendToContentScript(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch (e) {
    applyStatus('error', 'Cannot reach page. Make sure you are on a Springboard course.');
    addLog('Error: content script not reachable', 'error');
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────
btnStart.addEventListener('click', async () => {
  isPaused = false;
  applyStatus('running', 'Starting automation...');
  addLog('▶ Automation started', 'running');
  await sendToContentScript('START');
});

btnPause.addEventListener('click', async () => {
  if (isPaused) {
    // Resume
    isPaused = false;
    applyStatus('running', 'Resuming...');
    addLog('▶ Resumed', 'running');
    await sendToContentScript('RESUME');
  } else {
    // Pause
    isPaused = true;
    applyStatus('paused', 'Paused by user');
    addLog('⏸ Paused', 'skip');
    await sendToContentScript('PAUSE');
  }
});

btnStop.addEventListener('click', async () => {
  isPaused = false;
  applyStatus('idle', 'Stopped');
  addLog('■ Stopped by user', 'error');
  await sendToContentScript('STOP');
  btnStart.disabled  = false;
  btnPause.disabled  = true;
  btnStop.disabled   = true;
});

clearLogBtn.addEventListener('click', () => {
  logFeed.innerHTML = '<div class="log-entry idle">Log cleared</div>';
});

// ── Listen for status updates from content script ─────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'STATUS_UPDATE') return;

  const { status, message, completed = 0, total = 0, skipped = 0 } = msg;

  const logType =
    status === 'done'    ? 'done'    :
    status === 'error'   ? 'error'   :
    status === 'paused'  ? 'skip'    :
    status === 'stopped' ? 'error'   : 'running';

  addLog(message, logType);
  applyStatus(status === 'stopped' ? 'idle' : status, message, { completed, total, skipped });

  if (status === 'done' || status === 'stopped') {
    btnStart.disabled = false;
    btnPause.disabled = true;
    btnStop.disabled  = true;
  }
});

// ── On popup open, restore current state ─────────────────────────────────────
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const isOnSpringboard =
    tab.url?.includes('onwingspan.com') ||
    tab.url?.includes('springboard.infosys.com');

  if (!isOnSpringboard) {
    applyStatus('idle', 'Navigate to an Infosys Springboard course first');
    btnStart.disabled = true;
    return;
  }

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' });
    if (resp?.isRunning && !resp?.isPaused) {
      applyStatus('running', 'Automation in progress...');
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled  = false;
    } else if (resp?.isPaused) {
      applyStatus('paused', 'Paused — click Resume to continue');
      isPaused = true;
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled  = false;
    }
  } catch (_) {
    // Content script not yet injected on this page
  }
})();
