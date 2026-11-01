// SpringBored (Assessment Edition) - Popup Script
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
const statusState       = document.getElementById('statusState');
const copyrightYear     = document.getElementById('copyrightYear');
const engineState       = document.getElementById('engineState');

// AI Settings Elements
const aiQuizToggle      = document.getElementById('aiQuizToggle');
const aiCardBody        = document.getElementById('aiCardBody');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const btnToggleKeyVis   = document.getElementById('btnToggleKeyVis');
const btnSaveKey        = document.getElementById('btnSaveKey');
const keyStatusText     = document.getElementById('keyStatusText');

let isPaused = false;
let hasAcceptedTerms = false;
let lastProgress = null;

// ── Auto copyright year ──────────────────────────────────────────────────────
if (copyrightYear) copyrightYear.textContent = String(new Date().getFullYear());

// ── Screen Navigation Helpers ────────────────────────────────────────────────
function showDashboard() {
  noticeModal.hidden = true;
  appWrapper.hidden = false;
}

function showNotice(canClose = false) {
  appWrapper.hidden = true;
  noticeModal.hidden = false;
  if (canClose) {
    if (btnCloseNotice) btnCloseNotice.hidden = false;
    if (btnAcceptText)  btnAcceptText.textContent = 'Back to dashboard';
  } else {
    if (btnCloseNotice) btnCloseNotice.hidden = true;
    if (btnAcceptText)  btnAcceptText.textContent = 'I understand — open the dashboard';
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
const LEGACY_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-3.8-flash',
  'gemini-3.5-flash'
]);

function formatModelName(modelCode) {
  if (!modelCode) return 'Gemini AI';
  const clean = String(modelCode).replace(/^models\//, '').trim();
  if (clean === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro';
  if (clean === 'gemini-3-pro-preview') return 'Gemini 3 Pro';
  if (clean === 'gemini-3-flash-preview') return 'Gemini 3 Flash';
  if (clean === 'gemini-2.5-pro') return 'Gemini 2.5 Pro';
  if (clean === 'gemini-2.5-flash') return 'Gemini 2.5 Flash';
  if (clean === 'gemini-2.5-flash-lite') return 'Gemini 2.5 Flash Lite';
  if (clean === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
  if (clean === 'gemini-pro-latest') return 'Gemini Pro Latest';
  if (clean === 'gemini-flash-latest') return 'Gemini Flash Latest';
  return clean
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Initialize AI Quiz Settings ──────────────────────────────────────────────
const modelSelect         = document.getElementById('modelSelect');
const quizBadgeModelText  = document.getElementById('quizBadgeModelText');

/** Keep the dropdown in sync with a model that the API validated but the list lacks. */
function ensureModelOption(modelName) {
  if (!modelSelect || !modelName) return;
  const exists = [...modelSelect.options].some(o => o.value === modelName);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = modelName;
    opt.textContent = `${formatModelName(modelName)} (validated)`;
    modelSelect.appendChild(opt);
  }
}

chrome.storage.local.get(['aiQuizEnabled', 'geminiApiKey', 'geminiModel'], (data) => {
  const isEnabled = data.aiQuizEnabled !== false; // Default true
  if (aiQuizToggle) {
    aiQuizToggle.checked = isEnabled;
    updateAiCardState(isEnabled);
  }

  let modelName = (data.geminiModel || '').replace(/^models\//, '').trim();
  if (!modelName || LEGACY_MODELS.has(modelName.toLowerCase())) {
    modelName = 'gemini-2.5-flash';
    chrome.storage.local.set({ geminiModel: modelName });
  }

  // Do not silently overwrite a model the user validated. Add it to the list instead.
  ensureModelOption(modelName);
  if (modelSelect) {
    modelSelect.value = modelName;
  }
  if (quizBadgeModelText) {
    quizBadgeModelText.textContent = formatModelName(modelName);
  }

  if (data.geminiApiKey) {
    const cleanStoredKey = sanitizeApiKey(data.geminiApiKey);
    if (cleanStoredKey && cleanStoredKey !== data.geminiApiKey) {
      chrome.storage.local.set({ geminiApiKey: cleanStoredKey });
    }
    if (geminiApiKeyInput) geminiApiKeyInput.value = cleanStoredKey || data.geminiApiKey;
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
      addLog(`Model set to ${formatted}`, 'done');
    });
  });
}

function updateAiCardState(enabled) {
  if (aiCardBody) aiCardBody.classList.toggle('is-off', !enabled);
  if (engineState) {
    engineState.textContent = enabled ? 'On' : 'Off';
    engineState.classList.toggle('is-off', !enabled);
  }
}

if (aiQuizToggle) {
  aiQuizToggle.addEventListener('change', () => {
    const enabled = aiQuizToggle.checked;
    chrome.storage.local.set({ aiQuizEnabled: enabled });
    updateAiCardState(enabled);
    addLog(enabled ? 'AI assessment solver enabled' : 'AI assessment solver paused', 'running');
  });
}

// ── Toggle Password Visibility ──────────────────────────────────────────────
if (btnToggleKeyVis && geminiApiKeyInput) {
  btnToggleKeyVis.addEventListener('click', () => {
    const isPass = geminiApiKeyInput.type === 'password';
    geminiApiKeyInput.type = isPass ? 'text' : 'password';
    btnToggleKeyVis.textContent = isPass ? 'Hide' : 'Show';
  });
}

// ── API Key Sanitization & Direct Fallback Validator ─────────────────────────
function sanitizeApiKey(input) {
  if (!input || typeof input !== 'string') return '';
  let cleaned = input.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060\uFEFF]/g, '');

  const aizaMatch = cleaned.match(/AIza[A-Za-z0-9_-]{20,}/);
  if (aizaMatch) {
    return aizaMatch[0];
  }

  cleaned = cleaned.trim().replace(/^['"`]+|['"`]+$/g, '').replace(/\s+/g, '');

  const wrappedAizaMatch = cleaned.match(/AIza[A-Za-z0-9_-]{20,}/);
  if (wrappedAizaMatch) {
    return wrappedAizaMatch[0];
  }

  return cleaned;
}

function isValidApiKeyFormat(key) {
  const clean = sanitizeApiKey(key);
  if (!clean || clean.length < 16 || clean.length > 256) return false;
  return /^[A-Za-z0-9._-]+$/.test(clean);
}

/**
 * Direct fallback check from the popup in case the service worker is asleep or
 * reloading. Uses GET /v1beta/models which Google authenticates with the key.
 */
async function validateKeyDirectlyInPopup(cleanKey, targetModel) {
  const preferred = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-flash-latest'
  ];

  for (const ver of ['v1beta', 'v1']) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ver}/models`;
      const res = await fetch(url, {
        headers: { 'x-goog-api-key': cleanKey }
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const available = (data?.models || [])
          .filter(m => {
            const methods = m.supportedGenerationMethods || m.supportedActions || [];
            return methods.length === 0 || methods.includes('generateContent');
          })
          .map(m => (m.name || '').replace(/^models\//, ''))
          .filter(name => name.toLowerCase().includes('gemini'));

        let chosen = targetModel || 'gemini-2.5-flash';
        if (available.length > 0 && (!available.includes(chosen) || LEGACY_MODELS.has(chosen.toLowerCase()))) {
          chosen = preferred.find(p => available.includes(p)) || available.find(m => m.includes('flash')) || available[0];
        }
        return { success: true, model: chosen, apiVersion: ver };
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${res.status}`;
        return { success: false, error: msg };
      }
    } catch (e) {
      if (ver === 'v1') {
        return { success: false, error: e.message || 'Network error' };
      }
    }
  }

  return { success: false, error: 'Failed to connect to Gemini API' };
}

if (geminiApiKeyInput) {
  geminiApiKeyInput.addEventListener('input', () => {
    const cleaned = sanitizeApiKey(geminiApiKeyInput.value);
    if (cleaned && keyStatusText && keyStatusText.classList.contains('error')) {
      keyStatusText.textContent = 'Key entered — click Save & test.';
      keyStatusText.className = 'key-status';
    }
  });

  geminiApiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnSaveKey?.click();
    }
  });
}

// ── Save & Test API Key ──────────────────────────────────────────────────────
if (btnSaveKey && geminiApiKeyInput) {
  btnSaveKey.addEventListener('click', async () => {
    const rawKey = sanitizeApiKey(geminiApiKeyInput.value);
    geminiApiKeyInput.value = rawKey;

    if (!rawKey) {
      keyStatusText.textContent = 'Please enter an API key.';
      keyStatusText.className = 'key-status error';
      return;
    }

    if (!isValidApiKeyFormat(rawKey)) {
      keyStatusText.textContent = '✕ Invalid format. Paste the full key from Google AI Studio.';
      keyStatusText.className = 'key-status error';
      addLog('✕ Invalid API key format', 'error');
      return;
    }

    const targetModel = modelSelect ? modelSelect.value : 'gemini-2.5-flash';
    const targetLabel = formatModelName(targetModel);

    btnSaveKey.disabled = true;
    btnSaveKey.textContent = 'Testing…';
    keyStatusText.textContent = `Testing key with ${targetLabel}…`;
    keyStatusText.className = 'key-status testing';

    try {
      let response = await new Promise((resolve) => {
        let settled = false;
        let timer = null;

        const finish = (result) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(result ?? null);
        };

        timer = setTimeout(() => finish(null), 20000);

        try {
          chrome.runtime.sendMessage({
            type: 'TEST_GEMINI_KEY',
            apiKey: rawKey,
            model: targetModel
          }, (result) => {
            void chrome.runtime.lastError;
            finish(result);
          });
        } catch (_) {
          finish(null);
        }
      });

      // Fallback to direct popup validation if the service worker did not respond
      // or if an older service worker rejected a key that /models accepts.
      if (!response || !response.success) {
        const directRes = await validateKeyDirectlyInPopup(rawKey, targetModel);
        if (directRes.success || !response) {
          response = directRes;
        }
      }

      if (response && response.success) {
        const validatedModel = response.model || targetModel;
        const formatted = formatModelName(validatedModel);
        chrome.storage.local.set({
          geminiApiKey: rawKey,
          geminiModel: validatedModel,
          geminiApiVersion: response.apiVersion || 'v1beta'
        }, () => {
          ensureModelOption(validatedModel);
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
      btnSaveKey.textContent = 'Save & test';
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
  if (statusCard) statusCard.className = `status-card panel ${state}`;
  if (statusIcon) statusIcon.innerHTML = ICONS[state] || ICONS.idle;
  if (statusText) statusText.textContent = message;
  if (statusState) statusState.textContent = state;

  const isActive = state === 'running' || state === 'paused';
  if (btnStart) btnStart.disabled = isActive;
  if (btnPause) btnPause.disabled = !isActive;
  if (btnStop) btnStop.disabled  = !isActive;

  if (btnPause) {
    if (state === 'paused') {
      btnPause.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Resume</span>`;
    } else {
      btnPause.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> <span>Pause</span>`;
    }
  }

  if (data.total > 0) {
    lastProgress = {
      completed: Number.isFinite(data.completed) ? data.completed : 0,
      total: data.total
    };
  }

  const shownProgress = data.total > 0
    ? lastProgress
    : ((state === 'running' || state === 'paused') ? lastProgress : null);

  if (progressSection && shownProgress && shownProgress.total > 0) {
    progressSection.hidden = false;
    const pct = Math.min(100, Math.round((shownProgress.completed / shownProgress.total) * 100));
    if (progressFill) progressFill.style.width = pct + '%';
    if (progCount) progCount.textContent = `${shownProgress.completed} / ${shownProgress.total}`;
    if (doneCount) doneCount.textContent = shownProgress.completed;
  } else if (progressSection) {
    progressSection.hidden = true;
    if (state === 'idle') lastProgress = null;
  }
}

// ── Add entry to log feed ─────────────────────────────────────────────────────
function addLog(text, type = 'running') {
  if (!logFeed) return;
  const idle = logFeed.querySelector('.idle');
  if (idle) idle.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  const stamp = document.createElement('span');
  stamp.className = 'log-time';
  stamp.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });

  const message = document.createElement('span');
  message.className = 'log-msg';
  message.textContent = text;

  entry.append(stamp, message);
  logFeed.appendChild(entry);
  logFeed.scrollTop = logFeed.scrollHeight;

  while (logFeed.children.length > 60) {
    logFeed.removeChild(logFeed.firstChild);
  }
}

// ── Send action to content scripts (all frames, auto-injecting if needed) ─────
async function triggerSolverAction(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  let delivered = false;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action });
    if (res && res.ok) delivered = true;
  } catch (_) {
    delivered = false;
  }

  // If the tab was already open before the extension was loaded/reloaded,
  // content.js will not be running yet. Inject it on the fly and retry.
  if (!delivered && chrome.scripting?.executeScript) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
      await new Promise((r) => setTimeout(r, 250));
      await chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
    } catch (_) {}
  }

  // Also ask the service worker to dispatch to any registered child frames.
  chrome.runtime.sendMessage({ type: 'DISPATCH_ACTION', action }).catch(() => {});
}

// ── Button handlers ───────────────────────────────────────────────────────────
if (btnStart) {
  btnStart.addEventListener('click', async () => {
    if (!hasAcceptedTerms) {
      showNotice(false);
      return;
    }

    const enteredKey = sanitizeApiKey(geminiApiKeyInput?.value || '');
    if (enteredKey && isValidApiKeyFormat(enteredKey)) {
      if (geminiApiKeyInput) geminiApiKeyInput.value = enteredKey;
      await chrome.storage.local.set({ geminiApiKey: enteredKey });
    }

    isPaused = false;
    lastProgress = null;
    applyStatus('running', 'Launching Assessment Solver...');
    const activeName = formatModelName(modelSelect?.value || 'gemini-2.5-flash');
    addLog(`Launching assessment solver (${activeName})...`, 'running');
    await triggerSolverAction('START');
  });
}

if (btnPause) {
  btnPause.addEventListener('click', async () => {
    isPaused = !isPaused;
    if (isPaused) {
      applyStatus('paused', 'Paused.');
      addLog('Solver paused', 'paused');
      await triggerSolverAction('PAUSE');
    } else {
      applyStatus('running', 'Resumed.');
      addLog('Resumed solving', 'running');
      await triggerSolverAction('RESUME');
    }
  });
}

if (btnStop) {
  btnStop.addEventListener('click', async () => {
    isPaused = false;
    applyStatus('idle', 'Stopped.');
    addLog('Solver stopped by user', 'error');
    await triggerSolverAction('STOP');
  });
}

if (clearLogBtn) {
  clearLogBtn.addEventListener('click', () => {
    if (logFeed) {
      logFeed.innerHTML = '<div class="log-entry idle">Activity cleared.</div>';
    }
  });
}

// ── Listen for status updates from content scripts ───────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender?.id && sender.id !== chrome.runtime.id) return;
  if (msg.type === 'PERSONAL_STATS_UPDATED' && msg.stats) {
    renderPersonalStats(msg.stats);
    return;
  }
  if (msg.type === 'STATUS_UPDATE') {
    const displayState = msg.status === 'stopped' ? 'idle' : msg.status;

    // The HUD (or another popup) can pause the solver too. Mirror its state so
    // clicking the visible Resume button sends RESUME rather than PAUSE.
    if (msg.status === 'paused') {
      isPaused = true;
    } else if (msg.status === 'running' || msg.status === 'stopped' || msg.status === 'done' || msg.status === 'error') {
      isPaused = false;
    }

    if (msg.model) {
      const formattedModel = formatModelName(msg.model);
      ensureModelOption(msg.model);
      if (modelSelect) modelSelect.value = msg.model;
      if (quizBadgeModelText) quizBadgeModelText.textContent = formattedModel;
      if (keyStatusText && geminiApiKeyInput?.value) {
        keyStatusText.textContent = `✓ Active (${formattedModel})`;
        keyStatusText.className = 'key-status success';
      }
    }

    const logType =
      msg.status === 'paused'  ? 'skip'  :
      msg.status === 'stopped' ? 'error' :
      msg.status;

    applyStatus(displayState, msg.message, {
      completed: msg.completed,
      total: msg.total,
      quizzes: msg.quizzes
    });
    addLog(msg.message, logType);
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
    pageGuard.hidden = isSpringboard;
  }

  // Restore the last status from the service worker. This is the only reliable
  // way to see a run that lives inside an assessment iframe.
  try {
    const bg = await chrome.runtime.sendMessage({ type: 'GET_TAB_STATUS', tabId: tab.id });
    const last = bg?.status;
    const age = last?.receivedAt ? Date.now() - last.receivedAt : Infinity;
    if (last && last.status !== 'stopped' && last.status !== 'idle' && age < 30 * 60 * 1000) {
      const logType =
        last.status === 'paused' ? 'skip' :
        last.status === 'error'  ? 'error' :
        last.status;
      applyStatus(last.status, last.message, last);
      isPaused = last.status === 'paused';
      if (last.message) addLog(last.message, logType);
      return;
    }
  } catch (_) {
    // Older service worker or extension reloaded; fall back to frame 0 below.
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

// ── Personal Impact Stats & GitHub Releases Update Checker ──────────────────
const updateBanner       = document.getElementById('updateBanner');
const updateVersionBadge = document.getElementById('updateVersionBadge');
const updateBannerMsg    = document.getElementById('updateBannerMsg');
const updateDownloadLink = document.getElementById('updateDownloadLink');
const btnDismissUpdate   = document.getElementById('btnDismissUpdate');
const btnCheckUpdate     = document.getElementById('btnCheckUpdate');
const currentVerLabel    = document.getElementById('currentVersionLabel');
const statTimeSaved      = document.getElementById('statTimeSaved');
const statQuestions      = document.getElementById('statQuestions');
const statAssessments    = document.getElementById('statAssessments');

function formatDurationSaved(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${Math.round(s)}s`;
  const mins = s / 60;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

function renderPersonalStats(stats = {}) {
  if (statTimeSaved) statTimeSaved.textContent = formatDurationSaved(stats.savedSeconds || 0);
  if (statQuestions) statQuestions.textContent = String(stats.questionsSolved || 0);
  if (statAssessments) statAssessments.textContent = String(stats.assessmentsCompleted || 0);
}

function renderUpdateBanner(info, dismissedVersion) {
  if (!updateBanner) return;
  if (info?.available && info.latestVersion && info.latestVersion !== dismissedVersion) {
    updateBanner.hidden = false;
    if (updateVersionBadge) updateVersionBadge.textContent = `v${info.latestVersion}`;
    if (updateBannerMsg) updateBannerMsg.textContent = `Update v${info.latestVersion} available`;
    if (updateDownloadLink) {
      updateDownloadLink.href = info.releaseUrl || 'https://github.com/OjasD07/SpringBored/releases/latest';
    }
  } else {
    updateBanner.hidden = true;
  }
}

if (currentVerLabel && chrome.runtime?.getManifest) {
  currentVerLabel.textContent = `v${chrome.runtime.getManifest().version || '1.0.0'}`;
}

chrome.storage.local.get(['personalStats', 'updateInfo', 'dismissedUpdateVersion'], (data) => {
  renderPersonalStats(data.personalStats || {});
  renderUpdateBanner(data.updateInfo, data.dismissedUpdateVersion);
});

chrome.runtime.sendMessage({ type: 'CHECK_FOR_UPDATES', force: false }, (info) => {
  void chrome.runtime.lastError;
  if (info) {
    chrome.storage.local.get(['dismissedUpdateVersion'], (d) => {
      renderUpdateBanner(info, d.dismissedUpdateVersion);
    });
  }
});

if (btnDismissUpdate) {
  btnDismissUpdate.addEventListener('click', () => {
    const ver = updateVersionBadge?.textContent?.replace(/^v/i, '') || '';
    if (updateBanner) updateBanner.hidden = true;
    if (ver) chrome.storage.local.set({ dismissedUpdateVersion: ver });
  });
}

if (btnCheckUpdate) {
  btnCheckUpdate.addEventListener('click', () => {
    btnCheckUpdate.textContent = 'Checking…';
    chrome.runtime.sendMessage({ type: 'CHECK_FOR_UPDATES', force: true }, (info) => {
      void chrome.runtime.lastError;
      if (info?.available) {
        chrome.storage.local.remove(['dismissedUpdateVersion']);
        renderUpdateBanner(info, null);
        btnCheckUpdate.textContent = `v${info.latestVersion} available!`;
        addLog(`Update v${info.latestVersion} available on GitHub Releases`, 'done');
      } else {
        const cur = chrome.runtime.getManifest?.()?.version || '1.0.0';
        btnCheckUpdate.textContent = `Up to date (v${cur})`;
        addLog(`Extension is up to date (v${cur})`, 'done');
        setTimeout(() => {
          btnCheckUpdate.textContent = 'Check updates';
        }, 3000);
      }
    });
  });
}
