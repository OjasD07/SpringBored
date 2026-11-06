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
const statusState    = document.getElementById('statusState');
const copyrightYear  = document.getElementById('copyrightYear');

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
  statusCard.className = `status-card panel ${state}`;
  statusIcon.innerHTML = ICONS[state] || ICONS.idle;
  statusText.textContent = message;
  if (statusState) statusState.textContent = state;

  const isActive = state === 'running' || state === 'paused';
  btnStart.disabled = isActive;
  btnPause.disabled = !isActive;
  btnStop.disabled  = !isActive;

  if (state === 'paused') {
    btnPause.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Resume</span>`;
  } else {
    btnPause.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> <span>Pause</span>`;
  }

  if (data.total > 0) {
    lastProgress = {
      completed: Number.isFinite(data.completed) ? data.completed : 0,
      total: data.total,
      skipped: Number.isFinite(data.skipped) ? data.skipped : (lastProgress?.skipped || 0)
    };
  }

  const shownProgress = data.total > 0
    ? lastProgress
    : ((state === 'running' || state === 'paused') ? lastProgress : null);

  if (progressSection && shownProgress && shownProgress.total > 0) {
    progressSection.hidden = false;
    const pct = Math.min(100, Math.round((shownProgress.completed / shownProgress.total) * 100));
    progressFill.style.width = pct + '%';
    progCount.textContent   = `${shownProgress.completed} / ${shownProgress.total}`;
    doneCount.textContent   = shownProgress.completed;
    skipCount.textContent   = shownProgress.skipped ?? 0;
  } else if (progressSection) {
    progressSection.hidden = true;
    if (state === 'idle') lastProgress = null;
  }
}

// ── Add entry to log feed ─────────────────────────────────────────────────────
function addLog(text, type = 'running') {
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

// ── Send action to active tab's content script ────────────────────────────────
async function sendToContentScript(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch (e) {
    if (chrome.scripting?.executeScript) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise((r) => setTimeout(r, 250));
        await chrome.tabs.sendMessage(tab.id, { action });
        return;
      } catch (_) {}
    }
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
  lastProgress = null;
  applyStatus('running', 'Opening Contents tab...');
  addLog('Automation started', 'running');
  await sendToContentScript('START');
});

btnPause.addEventListener('click', async () => {
  if (isPaused) {
    isPaused = false;
    applyStatus('running', 'Resuming...');
    addLog('Resumed', 'running');
    await sendToContentScript('RESUME');
  } else {
    isPaused = true;
    applyStatus('paused', 'Paused by user');
    addLog('Paused by user', 'skip');
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
  logFeed.innerHTML = '<div class="log-entry idle">Activity cleared</div>';
});

// ── Listen for status & personal stats updates ──────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender?.id && sender.id !== chrome.runtime.id) return;
  if (msg.type === 'PERSONAL_STATS_UPDATED' && msg.stats) {
    renderPersonalStats(msg.stats);
    return;
  }
  if (msg.type !== 'STATUS_UPDATE') return;

  const { status, message, completed = 0, total = 0, skipped = 0 } = msg;

  // Keep the popup's Pause/Resume button in sync with a run controlled from
  // elsewhere (e.g. the floating HUD or another window).
  if (status === 'paused') {
    isPaused = true;
  } else if (status === 'running' || status === 'stopped' || status === 'done' || status === 'error') {
    isPaused = false;
  }

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
    pageGuard.hidden = false;
    pageGuard.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>Not on Springboard. Go to <strong>infyspringboard.onwingspan.com</strong> first.</span>`;
    btnStart.disabled = true;
    return;
  }

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' });

    if (!resp?.onViewerPage) {
      pageGuard.hidden = false;
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

// ── Personal Impact Stats & GitHub Releases Update Checker ──────────────────
const updateBanner       = document.getElementById('updateBanner');
const updateVersionBadge = document.getElementById('updateVersionBadge');
const updateBannerMsg    = document.getElementById('updateBannerMsg');
const updateDownloadLink = document.getElementById('updateDownloadLink');
const btnDismissUpdate   = document.getElementById('btnDismissUpdate');
const btnCheckUpdate     = document.getElementById('btnCheckUpdate');
const currentVerLabel    = document.getElementById('currentVersionLabel');
const statTimeSaved      = document.getElementById('statTimeSaved');
const statLectures       = document.getElementById('statLectures');
const statCourses        = document.getElementById('statCourses');

function formatDurationSaved(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${Math.round(s)}s`;
  const mins = s / 60;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

function renderPersonalStats(stats = {}) {
  if (statTimeSaved) statTimeSaved.textContent = formatDurationSaved(stats.savedSeconds || 0);
  if (statLectures) statLectures.textContent = String(stats.lecturesCompleted || 0);
  if (statCourses) statCourses.textContent = String(stats.coursesCompleted || 0);
}

function renderUpdateBanner(info, dismissedVersion) {
  if (!updateBanner) return;
  if (info?.available && info.latestVersion && info.latestVersion !== dismissedVersion) {
    updateBanner.hidden = false;
    if (updateVersionBadge) updateVersionBadge.textContent = `v${info.latestVersion}`;
    if (updateBannerMsg) updateBannerMsg.textContent = `Update v${info.latestVersion} available`;
    if (updateDownloadLink) {
      updateDownloadLink.href = info.releaseUrl || 'https://github.com/OjasD07/SpringBored/releases#release-course-v1.1.0';
    }
  } else {
    updateBanner.hidden = true;
  }
}

if (currentVerLabel && chrome.runtime?.getManifest) {
  currentVerLabel.textContent = `v${chrome.runtime.getManifest().version || '1.1.0'}`;
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
        const cur = chrome.runtime.getManifest?.()?.version || '1.1.0';
        btnCheckUpdate.textContent = `Up to date (v${cur})`;
        addLog(`Extension is up to date (v${cur})`, 'done');
        setTimeout(() => {
          btnCheckUpdate.textContent = 'Updates';
        }, 3000);
      }
    });
  });
}
