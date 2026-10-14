// SpringBored (Assignment Edition) - Popup Script
// Controls Gemini 3.8 Flash Assessment Solver

const btnStart          = document.getElementById('btnStart');
const btnPause          = document.getElementById('btnPause');
const btnStop           = document.getElementById('btnStop');
const statusDot         = document.getElementById('statusDot');
const statusCard        = document.getElementById('statusCard');
const statusIcon        = document.getElementById('statusIcon');
const statusText        = document.getElementById('statusText');
const progressSection   = document.getElementById('progressSection');
const progressFill      = document.getElementById('progressFill');
const progCount         = document.getElementById('progCount');
const doneCount         = document.getElementById('doneCount');
const logFeed           = document.getElementById('logFeed');
const clearLogBtn       = document.getElementById('clearLog');
const pageGuard         = document.getElementById('pageGuard');
const appWrapper        = document.getElementById('appWrapper');
const noticeModal       = document.getElementById('noticeModal');
const btnAcceptNotice    = document.getElementById('btnAcceptNotice');
const btnAcceptText     = document.getElementById('btnAcceptText');
const btnCloseNotice    = document.getElementById('btnCloseNotice');
const btnOpenNotice     = document.getElementById('btnOpenNotice');

// AI Settings Elements
const aiQuizToggle      = document.getElementById('aiQuizToggle');
const aiCardBody        = document.getElementById('aiCardBody');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const btnToggleKeyVis   = document.getElementById('btnToggleKeyVis');
const btnSaveKey        = document.getElementById('btnSaveKey');
const keyStatusText     = document.getElementById('keyStatusText');

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

// ── Terms & Notice Acceptance (One-time check) ──────────────────────────────
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

// ── Initialize AI Quiz Settings ──────────────────────────────────────────────
chrome.storage.local.get(['aiQuizEnabled', 'geminiApiKey', 'geminiModel'], (data) => {
  const isEnabled = data.aiQuizEnabled !== false; // Default true
  if (aiQuizToggle) {
    aiQuizToggle.checked = isEnabled;
    updateAiCardState(isEnabled);
  }

  if (data.geminiApiKey) {
    if (geminiApiKeyInput) geminiApiKeyInput.value = data.geminiApiKey;
    let modelName = data.geminiModel || 'gemini-2.0-flash';
    if (modelName.toLowerCase().startsWith('gemma')) {
      modelName = 'gemini-2.0-flash';
      chrome.storage.local.set({ geminiModel: modelName });
    }
    if (keyStatusText) {
      keyStatusText.textContent = `✓ Active (${modelName})`;
      keyStatusText.className = 'key-status success';
    }
  } else {
    if (keyStatusText) {
      keyStatusText.textContent = 'No key saved. Paste your key above.';
      keyStatusText.className = 'key-status error';
    }
  }
});

function updateAiCardState(enabled) {
  if (!aiCardBody) return;
  aiCardBody.style.opacity = enabled ? '1' : '0.45';
  aiCardBody.style.pointerEvents = enabled ? 'auto' : 'none';
}

if (aiQuizToggle) {
  aiQuizToggle.addEventListener('change', () => {
    const enabled = aiQuizToggle.checked;
    chrome.storage.local.set({ aiQuizEnabled: enabled });
    updateAiCardState(enabled);
    addLog(enabled ? '✨ AI Assessment Solver enabled' : '⏸ AI Assessment Solver paused', 'running');
  });
}

// ── Toggle Password Visibility ──────────────────────────────────────────────
if (btnToggleKeyVis && geminiApiKeyInput) {
  btnToggleKeyVis.addEventListener('click', () => {
    const isPass = geminiApiKeyInput.type === 'password';
    geminiApiKeyInput.type = isPass ? 'text' : 'password';
  });
}

// ── Save & Test API Key ──────────────────────────────────────────────────────
if (btnSaveKey && geminiApiKeyInput) {
  btnSaveKey.addEventListener('click', async () => {
    const rawKey = geminiApiKeyInput.value.trim();
    if (!rawKey) {
      keyStatusText.textContent = 'Please enter an API key.';
      keyStatusText.className = 'key-status error';
      return;
    }

    btnSaveKey.disabled = true;
    btnSaveKey.textContent = 'Testing...';
    keyStatusText.textContent = 'Testing key with Google Gemini API...';
    keyStatusText.className = 'key-status';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'TEST_GEMINI_KEY', apiKey: rawKey }, resolve);
      });

      if (response && response.success) {
        chrome.storage.local.set({
          geminiApiKey: rawKey,
          geminiModel: response.model || 'gemini-2.0-flash',
          geminiApiVersion: response.version || 'v1beta'
        }, () => {
          keyStatusText.textContent = `✓ Active (${response.model || 'gemini-2.0-flash'})`;
          keyStatusText.className = 'key-status success';
          addLog(`✓ Gemini connected successfully (${response.model || 'gemini-2.0-flash'})`, 'done');
        });
      } else {
        const errorMsg = response?.error || 'Validation failed. Check your key.';
        keyStatusText.textContent = `✕ ${errorMsg}`;
        keyStatusText.className = 'key-status error';
        addLog(`✕ Gemini key validation error: ${errorMsg}`, 'error');
      }
    } catch (e) {
      keyStatusText.textContent = `✕ Error: ${e.message}`;
      keyStatusText.className = 'key-status error';
      addLog(`✕ Network error during test: ${e.message}`, 'error');
    } finally {
      btnSaveKey.disabled = false;
      btnSaveKey.textContent = 'Save & Test';
    }
  });
}

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
  if (statusDot) statusDot.className  = `status-dot ${state}`;
  if (statusCard) statusCard.className = `status-card ${state}`;
  if (statusIcon) statusIcon.innerHTML = ICONS[state] || ICONS.idle;
  if (statusText) statusText.textContent = message;

  const isActive = state === 'running' || state === 'paused';
  if (btnStart) btnStart.disabled = isActive;
  if (btnPause) btnPause.disabled = !isActive;
  if (btnStop) btnStop.disabled  = !isActive;

  if (btnPause) {
    if (state === 'paused') {
      btnPause.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Resume</span>`;
    } else {
      btnPause.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> <span>Pause</span>`;
    }
  }

  if (progressSection && data.total > 0) {
    progressSection.style.display = 'flex';
    const pct = Math.min(100, Math.round((data.completed / data.total) * 100));
    if (progressFill) progressFill.style.width = pct + '%';
    if (progCount) progCount.textContent = `${data.completed} / ${data.total}`;
    if (doneCount) doneCount.textContent = data.completed;
  }
}

// ── Add entry to log feed ─────────────────────────────────────────────────────
function addLog(text, type = 'running') {
  if (!logFeed) return;
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

// ── Send action to content script and frames ─────────────────────────────────
async function triggerSolverAction(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Direct tab message
  chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});

  // Broadcast to all frames via background
  chrome.runtime.sendMessage({ type: 'BROADCAST_START' }).catch(() => {});
}

// ── Button handlers ───────────────────────────────────────────────────────────
if (btnStart) {
  btnStart.addEventListener('click', async () => {
    if (!hasAcceptedTerms) {
      showNotice(false);
      return;
    }
    isPaused = false;
    applyStatus('running', 'Launching Assessment Solver...');
    addLog('▶ Launching Gemini 3.8 Flash Solver...', 'running');
    await triggerSolverAction('START');
  });
}

if (btnPause) {
  btnPause.addEventListener('click', async () => {
    isPaused = !isPaused;
    if (isPaused) {
      applyStatus('paused', 'Paused.');
      addLog('⏸ Solver paused', 'paused');
      await triggerSolverAction('PAUSE');
    } else {
      applyStatus('running', 'Resumed.');
      addLog('▶ Resumed solving', 'running');
      await triggerSolverAction('RESUME');
    }
  });
}

if (btnStop) {
  btnStop.addEventListener('click', async () => {
    isPaused = false;
    applyStatus('idle', 'Stopped.');
    addLog('⏹ Solver stopped by user', 'error');
    await triggerSolverAction('STOP');
  });
}

if (clearLogBtn) {
  clearLogBtn.addEventListener('click', () => {
    if (logFeed) {
      logFeed.innerHTML = '<div class="log-entry idle">Log cleared. Ready.</div>';
    }
  });
}

// ── Listen for status updates from content scripts ───────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    applyStatus(msg.status, msg.message, {
      completed: msg.completed,
      total: msg.total,
      quizzes: msg.quizzes
    });
    addLog(msg.message, msg.status);
  }
});

// ── Check Page on load ───────────────────────────────────────────────────────
async function checkActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  const url = tab.url.toLowerCase();
  const isSpringboard =
    url.includes('onwingspan.com') ||
    url.includes('infosys') ||
    url.includes('springboard');

  if (pageGuard) {
    pageGuard.style.display = isSpringboard ? 'none' : 'flex';
  }

  // Ask content script for current status
  chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res && res.isRunning) {
      applyStatus(res.isPaused ? 'paused' : 'running', res.isPaused ? 'Paused' : 'Solving assessment...');
    }
  });
}

checkActivePage();
