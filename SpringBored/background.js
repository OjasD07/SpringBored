// SpringBored (Course Edition) - Background Service Worker
// Relays messages, tracks anonymous impact telemetry, and checks GitHub Releases for updates

const EDITION = 'course';
const TELEMETRY_ENDPOINT = 'https://springbored.ojasdeshpande.in/api/telemetry';
const VERSION_ENDPOINT = 'https://springbored.ojasdeshpande.in/api/version';
const GITHUB_RELEASE_API = 'https://api.github.com/repos/OjasD07/SpringBored/releases';
const GITHUB_RELEASES_URL = 'https://github.com/OjasD07/SpringBored/releases#release-course-v1.1.0';
const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

async function getOrCreateClientId() {
  const data = await chrome.storage.local.get(['telemetryClientId']);
  if (data.telemetryClientId) return data.telemetryClientId;
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'sb-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  await chrome.storage.local.set({ telemetryClientId: id });
  return id;
}

function extractSemver(v) {
  const s = String(v || '').trim();
  const m = s.match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : s.replace(/^v/i, '');
}

function compareSemver(a, b) {
  const pa = extractSemver(a)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = extractSemver(b)
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function recordTelemetryEvent(event, metrics = {}) {
  try {
    const clientId = await getOrCreateClientId();
    const version = chrome.runtime.getManifest().version || '1.1.0';
    const { personalStats = {} } = await chrome.storage.local.get(['personalStats']);

    const nextStats = {
      savedSeconds: (Number(personalStats.savedSeconds) || 0) + (Number(metrics.savedSeconds) || 0),
      useTimeSeconds: (Number(personalStats.useTimeSeconds) || 0) + (Number(metrics.useTimeSeconds) || 0),
      lecturesCompleted: (Number(personalStats.lecturesCompleted) || 0) + (Number(metrics.lectures) || 0),
      modulesCompleted: (Number(personalStats.modulesCompleted) || 0) + (Number(metrics.modules) || 0),
      coursesCompleted: (Number(personalStats.coursesCompleted) || 0) + (Number(metrics.courses) || 0),
      questionsSolved: Number(personalStats.questionsSolved) || 0,
      assessmentsCompleted: Number(personalStats.assessmentsCompleted) || 0
    };

    await chrome.storage.local.set({ personalStats: nextStats });
    chrome.runtime.sendMessage({ type: 'PERSONAL_STATS_UPDATED', stats: nextStats }).catch(() => {});

    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        edition: EDITION,
        version,
        clientId,
        metrics,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {});
  } catch (_) {}
}

async function checkForExtensionUpdate(force = false) {
  const currentVersion = chrome.runtime.getManifest().version || '1.1.0';
  try {
    const { updateInfo } = await chrome.storage.local.get(['updateInfo']);
    if (
      !force &&
      updateInfo?.checkedAt &&
      Date.now() - updateInfo.checkedAt < UPDATE_CHECK_INTERVAL_MS
    ) {
      return updateInfo;
    }

    let latestVersion = currentVersion;
    let releaseUrl = GITHUB_RELEASES_URL;
    let notes = '';

    // 1. Try SpringBored website version API
    try {
      const res = await fetch(VERSION_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error('Version API HTTP ' + res.status);
      const data = await res.json();
      latestVersion = extractSemver(data.courseVersion || data.latestVersion || currentVersion);
      releaseUrl = data.courseReleaseUrl || data.releaseUrl || GITHUB_RELEASES_URL;
      notes = data.changelog || '';
    } catch (_) {
      // 2. Fallback directly to GitHub Releases API
      const ghRes = await fetch(GITHUB_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store'
      });
      if (ghRes.ok) {
        const ghData = await ghRes.json();
        const rel = Array.isArray(ghData)
          ? ghData.find((r) => !r.draft && /course/i.test(`${r.tag_name || ''} ${r.name || ''}`)) ||
            ghData.find((r) => !r.draft) ||
            ghData[0]
          : ghData;
        if (rel) {
          latestVersion = extractSemver(rel.tag_name || currentVersion);
          releaseUrl = rel.tag_name
            ? `https://github.com/OjasD07/SpringBored/releases#release-${rel.tag_name}`
            : rel.html_url || GITHUB_RELEASES_URL;
          notes = String(rel.name || rel.body || '').slice(0, 140);
        }
      }
    }

    const available = compareSemver(latestVersion, currentVersion) > 0;
    const info = {
      available,
      currentVersion,
      latestVersion,
      releaseUrl,
      notes,
      checkedAt: Date.now()
    };

    await chrome.storage.local.set({ updateInfo: info });

    if (chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: available ? 'NEW' : '' });
      if (available) {
        chrome.action.setBadgeBackgroundColor({ color: '#e5a952' });
      }
    }

    return info;
  } catch (e) {
    return {
      available: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: GITHUB_RELEASES_URL,
      error: e.message || 'Check failed',
      checkedAt: Date.now()
    };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SpringBored] Extension installed.');
  recordTelemetryEvent(details.reason === 'update' ? 'extension_updated' : 'extension_installed');
  checkForExtensionUpdate(true);
});

chrome.runtime.onStartup?.addListener(() => {
  checkForExtensionUpdate(false);
});

// Relay messages from content script → popup & handle telemetry/update requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender?.id && sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === 'STATUS_UPDATE') {
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  if (message.type === 'TELEMETRY_EVENT') {
    recordTelemetryEvent(message.event, message.metrics || {});
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'CHECK_FOR_UPDATES') {
    checkForExtensionUpdate(!!message.force).then(sendResponse);
    return true;
  }

  return false;
});
