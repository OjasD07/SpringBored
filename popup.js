// SpringBored - Popup Script

const btnStart       = document.getElementById('btnStart');
const btnPause       = document.getElementById('btnPause');
const btnStop        = document.getElementById('btnStop');
const statusDot      = document.getElementById('statusDot');
const statusCard     = document.getElementById('statusCard');
const statusIcon     = document.getElementById('statusIcon');
const statusText     = document.getElementById('statusText');
const progressSection = document.getElementById('progressSection');
const progressFill   = document.getElementById('progressFill');
const progCount      = document.getElementById('progCount');
const skipCount      = document.getElementById('skipCount');
const doneCount      = document.getElementById('doneCount');
const logFeed        = document.getElementById('logFeed');
const clearLogBtn    = document.getElementById('clearLog');
const pageGuard      = document.getElementById('pageGuard');
const appWrapper     = document.getElementById('appWrapper');
const noticeModal    = document.getElementById('noticeModal');
const btnAcceptNotice = document.getElementById('btnAcceptNotice');
const btnAcceptText  = document.getElementById('btnAcceptText');
const btnCloseNotice = document.getElementById('btnCloseNotice');
const btnOpenNotice  = document.getElementById('btnOpenNotice');

let isPaused = false;
let hasAcceptedTerms = false;

// ── Screen Navigation Helpers ────────────────────────────────────────────────
function showDashboard() {
  noticeModal.style.display = 'none';
  appWrapper.style.display = 'flex';
}

function showNotice(canClose = false) {
  appWrapper.style.display = 'none';
  noticeModal.style.display = 'flex';
  if (canClose) {
    if (btnCloseNotice) btnCloseNotice.style.display = 'block';
    if (btnAcceptText)  btnAcceptText.textContent = 'Back to Dashboard';
  } else {
    if (btnCloseNotice) btnCloseNotice.style.display = 'none';
    if (btnAcceptText)  btnAcceptText.textContent = 'I Understand & Accept';
  }
}

// ── Check Terms & Notice Acceptance (One-time check) ──────────────────────────
chrome.storage.local.get(['hasAcceptedTerms'], (result) => {
  if (result.hasAcceptedTerms) {
    hasAcceptedTerms = true;
    showDashboard();
  } else {
    hasAcceptedTerms = false;
    showNotice(false);
  }
});

btnAcceptNotice.addEventListener('click', () => {
  if (!hasAcceptedTerms) {
    hasAcceptedTerms = true;
    chrome.storage.local.set({ hasAcceptedTerms: true }, () => {
      showDashboard();
      addLog('✓ Terms & privacy notice accepted', 'done');
    });
  } else {
    showDashboard();
  }
});

if (btnCloseNotice) {
  btnCloseNotice.addEventListener('click', () => {
    showDashboard();
  });
}

btnOpenNotice.addEventListener('click', () => {
  showNotice(true);
});

// ── Status icons ─────────────────────────────────────────────────────────────
const ICONS = {
  idle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  running: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  paused: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  done: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
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
    btnPause.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Resume</span>`;
  } else {
    btnPause.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> <span>Pause</span>`;
  }

  if (data.total > 0) {
    progressSection.style.display = 'flex';
    const pct = Math.min(100, Math.round((data.completed / data.total) * 100));
    progressFill.style.width = pct + '%';
    progCount.textContent   = `${data.completed} / ${data.total}`;
    doneCount.textContent   = data.completed;
    skipCount.textContent   = data.skipped ?? 0;
  }
}

// ── Add entry to log feed ─────────────────────────────────────────────────────
function addLog(text, type = 'running') {
  const idle = logFeed.querySelector('.idle');
  if (idle) idle.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logFeed.appendChild(entry);
  logFeed.scrollTop = logFeed.scrollHeight;

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
  if (!hasAcceptedTerms) {
    showNotice(false);
    return;
  }
  isPaused = false;
  applyStatus('running', 'Opening Contents tab...');
  addLog('▶ Automation started', 'running');
  await sendToContentScript('START');
});

btnPause.addEventListener('click', async () => {
  if (isPaused) {
    isPaused = false;
    applyStatus('running', 'Resuming...');
    addLog('▶ Resumed', 'running');
    await sendToContentScript('RESUME');
  } else {
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
  btnStart.disabled = false;
  btnPause.disabled = true;
  btnStop.disabled  = true;
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
    applyStatus('idle', 'Navigate to Infosys Springboard first');
    pageGuard.style.display = 'flex';
    pageGuard.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>Not on Springboard. Go to <strong>infyspringboard.onwingspan.com</strong> first.</span>`;
    btnStart.disabled = true;
    return;
  }

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' });

    if (!resp?.onViewerPage) {
      pageGuard.style.display = 'flex';
      btnStart.disabled = true;
      applyStatus('idle', 'Open a course and navigate to the viewer player page');
      return;
    }

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
    applyStatus('idle', 'Ready. Press Start on the course player page.');
  }
})();
