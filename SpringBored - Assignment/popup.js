// SpringBored (Assignment Edition) - Popup Script
// Controls Gemini AI Assessment Solver

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

// ── Dynamic Model Name Formatter ──────────────────────────────────────────────
function formatModelName(modelCode) {
  if (!modelCode) return 'Gemini AI';
  const clean = String(modelCode).replace(/^models\//, '').trim();
  if (clean === 'gemini-3.8-flash') return 'Gemini 3.8 Flash';
  if (clean === 'gemini-3.5-flash') return 'Gemini 3.5 Flash';
  if (clean === 'gemini-2.5-pro') return 'Gemini 2.5 Pro';
  if (clean === 'gemini-2.5-flash') return 'Gemini 2.5 Flash';
  if (clean === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
  if (clean === 'gemini-1.5-pro') return 'Gemini 1.5 Pro';
  if (clean === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';
  return clean
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Initialize AI Quiz Settings ──────────────────────────────────────────────
const modelSelect         = document.getElementById('modelSelect');
const quizBadgeModelText  = document.getElementById('quizBadgeModelText');

chrome.storage.local.get(['aiQuizEnabled', 'geminiApiKey', 'geminiModel'], (data) => {
  const isEnabled = data.aiQuizEnabled !== false; // Default true
  if (aiQuizToggle) {
    aiQuizToggle.checked = isEnabled;
    updateAiCardState(isEnabled);
  }

  const validModels = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];
  let modelName = data.geminiModel;
  if (!modelName || !validModels.includes(modelName)) {
    modelName = 'gemini-2.5-flash';
    chrome.storage.local.set({ geminiModel: modelName });
  }

  if (modelSelect) {
    modelSelect.value = modelName;
  }
  if (quizBadgeModelText) {
    quizBadgeModelText.textContent = formatModelName(modelName);
  }

  if (data.geminiApiKey) {
    if (geminiApiKeyInput) geminiApiKeyInput.value = data.geminiApiKey;
    if (keyStatusText) {
      keyStatusText.textContent = `✓ Active (${formatModelName(modelName)})`;
      keyStatusText.className = 'key-status success';
    }
  } else {
    if (keyStatusText) {
      keyStatusText.textContent = 'No key saved. Paste your key above.';
      keyStatusText.className = 'key-status error';
    }
  }
});

if (modelSelect) {
  modelSelect.addEventListener('change', () => {
    const selected = modelSelect.value;
    const formatted = formatModelName(selected);
    chrome.storage.local.set({ geminiModel: selected }, () => {
      if (keyStatusText && geminiApiKeyInput?.value) {
        keyStatusText.textContent = `✓ Active (${formatted})`;
      }
      if (quizBadgeModelText) {
        quizBadgeModelText.textContent = formatted;
      }
      addLog(`✨ Model set to ${formatted}`, 'done');
    });
  });
}

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

    // SECURITY: Validate key format before sending to background
    if (!/^AIza[A-Za-z0-9_-]{31,45}$/.test(rawKey)) {
      keyStatusText.textContent = '✕ Invalid format. Gemini keys start with "AIza" (~39 chars).';
      keyStatusText.className = 'key-status error';
      addLog('✕ Invalid API key format', 'error');
      return;
    }

    const targetModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';
    const targetLabel = formatModelName(targetModel);

    btnSaveKey.disabled = true;
    btnSaveKey.textContent = 'Testing...';
    keyStatusText.textContent = `Testing key with ${targetLabel}...`;
    keyStatusText.className = 'key-status';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'TEST_GEMINI_KEY',
          apiKey: rawKey,
          model: targetModel
        }, resolve);
      });

      if (response && response.success) {
        const validatedModel = response.model || targetModel;
        const formatted = formatModelName(validatedModel);
        chrome.storage.local.set({
          geminiApiKey: rawKey,
          geminiModel: validatedModel,
          geminiApiVersion: 'v1beta'
        }, () => {
          if (modelSelect) modelSelect.value = validatedModel;
          if (quizBadgeModelText) quizBadgeModelText.textContent = formatted;
          keyStatusText.textContent = `✓ Active (${formatted})`;
          keyStatusText.className = 'key-status success';
          addLog(`✓ Gemini connected successfully (${formatted})`, 'done');
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

// ── Send action to content script ───────────────────────────────────────────
async function triggerSolverAction(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
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
    const activeName = formatModelName(modelSelect?.value || 'gemini-2.5-flash');
    addLog(`▶ Launching AI Solver (${activeName})...`, 'running');
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
