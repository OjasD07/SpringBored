// SpringBored - Content Script v2
// Targets: infyspringboard.onwingspan.com/web/en/viewer/*

(function () {
  'use strict';

  // ─── GUARD: Only run on actual course viewer pages ────────────────────────
  // The viewer URL always contains /viewer/ — we must not touch the home page
  const ON_VIEWER_PAGE = /\/viewer\//.test(window.location.pathname);

  // ─── State ────────────────────────────────────────────────────────────────
  let isRunning = false;
  let isPaused  = false;

  // ─── Utils ────────────────────────────────────────────────────────────────
  const log = (msg) => console.log(`%c[SpringBored] ${msg}`, 'color:#7c6bff;font-weight:bold');

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /** Wait for a CSS selector to appear in the DOM, with timeout. */
  function waitForEl(selector, root = document, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const found = root.querySelector(selector);
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(root.body ?? root, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
    });
  }

  /** Dispatch status back to popup */
  function sendStatus(data) {
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', ...data }).catch(() => {});
  }

  // ─── STEP 1: Open the Contents / TOC sidebar tab ──────────────────────────
  // Real DOM: the TOC is already in the DOM as div.viewer-toc-container.
  // It may be hidden behind a tab — find the tab whose label includes "content".
  async function openContentsTab() {
    log('Opening Contents tab...');

    // Real container confirmed from live DOM
    const tocContainer = document.querySelector('.viewer-toc-container');
    if (tocContainer) {
      const style = window.getComputedStyle(tocContainer);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        log('TOC already visible');
        return true;
      }
    }

    // Try to click a tab button that reveals it
    const allBtns = [...document.querySelectorAll('button, [role="tab"]')];
    for (const btn of allBtns) {
      const label = (
        btn.getAttribute('aria-label') || btn.title || btn.textContent || ''
      ).toLowerCase();
      if (label.includes('content') && !label.includes('information')) {
        log('Clicking Contents tab: ' + label);
        btn.click();
        await sleep(1200);
        return true;
      }
    }

    log('TOC tab not found — assuming already visible');
    return true;
  }

  // ─── STEP 2: Expand all collapsed folder/module nodes ─────────────────────
  // Real DOM: folders are mat-tree-node.ws-player-tree-node with aria-expanded="false"
  // AND they contain a mat-icon.toc-expand-icon (leaf nodes do not have this icon).
  async function expandAllFolders() {
    log('Expanding all folders...');

    const toc = document.querySelector('.viewer-toc-container, .toc-container');
    if (!toc) { log('TOC container not found, skipping expand'); return; }

    // Expand in multiple passes (folders may reveal sub-folders after opening)
    for (let pass = 0; pass < 4; pass++) {
      const collapsedFolders = [...toc.querySelectorAll(
        'mat-tree-node.ws-player-tree-node[aria-expanded="false"]'
      )].filter(node => !!node.querySelector('mat-icon.toc-expand-icon'));

      if (collapsedFolders.length === 0) break;
      log(`Pass ${pass + 1}: expanding ${collapsedFolders.length} folder(s)`);

      for (const folder of collapsedFolders) {
        folder.click();
        await sleep(350);
      }
      await sleep(500);
    }

    log('Folders expanded');
  }

  // ─── STEP 3: Collect all leaf lesson items ────────────────────────────────
  // Real DOM: all nodes are mat-tree-node.ws-player-tree-node
  // FOLDERS have a mat-icon.toc-expand-icon child → skip them
  // LEAVES do NOT have that icon → these are clickable lessons
  function collectLessons() {
    const toc = document.querySelector('.viewer-toc-container, .toc-container');
    if (!toc) {
      log('TOC container not found');
      return [];
    }

    // Get all tree nodes and keep only leaf (non-folder) ones
    const allNodes = [...toc.querySelectorAll('mat-tree-node.ws-player-tree-node')];
    if (allNodes.length > 0) {
      const leaves = allNodes.filter(node => !node.querySelector('mat-icon.toc-expand-icon'));
      log(`Found ${allNodes.length} tree nodes, ${leaves.length} are leaf lessons`);
      return leaves;
    }

    // Fallback for other Wingspan deployments
    const fallbackSelectors = [
      'lex-toc-item',
      '.toc-item:not(.toc-collection)',
      '.toc-item-container',
    ];
    for (const sel of fallbackSelectors) {
      const items = [...toc.querySelectorAll(sel)];
      if (items.length > 0) {
        log(`Fallback: ${items.length} items via "${sel}"`);
        return items;
      }
    }

    log('No lesson items found in TOC');
    return [];
  }

  // ─── Helpers: assignment & completion detection ────────────────────────────
  function isAssignment(el) {
    const text = (el.textContent || '').toLowerCase();
    const id   = (el.id || '').toLowerCase();
    // ws-viewer-icon is the content-type icon; check its content too
    const iconEl = el.querySelector('ws-viewer-icon, [class*="content-type"]');
    const iconText = (iconEl?.textContent || iconEl?.getAttribute('type') || '').toLowerCase();
    return (
      text.includes('assignment') ||
      text.includes('quiz') ||
      text.includes('assessment') ||
      iconText.includes('assessment') ||
      iconText.includes('quiz')
    );
  }

  function isCompleted(el) {
    // Real DOM: completed nodes get an 'is-completed' or 'completed' class,
    // OR their ws-viewer-icon shows a checkmark/tick state.
    const cls = (el.className?.toString() || '').toLowerCase();
    const hasCheckIcon = !!el.querySelector(
      'mat-icon.tick, mat-icon.done, [class*="tick"], [class*="complete"], ws-viewer-icon[status="completed"]'
    );
    // Also check aria-selected or a data attribute marking completion
    return (
      hasCheckIcon ||
      cls.includes('completed') ||
      cls.includes('is-complete') ||
      el.getAttribute('aria-checked') === 'true' ||
      el.getAttribute('data-status') === 'completed'
    );
  }

  // ─── STEP 4: Handle video content ─────────────────────────────────────────
  // Seek to end, wait for "ended", then resolve.
  function handleVideoContent() {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (reason) => {
        if (!resolved) { resolved = true; resolve(reason); }
      };

      let elapsed = 0;
      const pollMs = 500;
      const maxWaitMs = 45000; // 45s max to find & finish video

      const poll = setInterval(async () => {
        if (!isRunning || isPaused) { clearInterval(poll); return done('paused'); }

        elapsed += pollMs;
        const video = document.querySelector('video');

        if (video && video.readyState >= 2 && video.duration > 0 && !isNaN(video.duration)) {
          clearInterval(poll);
          const dur = video.duration;
          log(`Video ready. Duration=${dur.toFixed(1)}s`);

          // Speed up & mute
          video.muted = true;
          try { video.playbackRate = 16; } catch (_) {}

          // Ensure it's playing
          if (video.paused) {
            try { await video.play(); } catch (_) {}
          }

        // Seek to 3s before end
          const seekTo = Math.max(0, dur - 3);
          await sleep(400);

          // Video.js wraps the native <video> — setting currentTime directly works,
          // but we should also try the vjs player API if available
          video.currentTime = seekTo;
          // Also try via Video.js global player instance if present
          try {
            if (window.videojs) {
              const vjsPlayer = window.videojs.getPlayers && Object.values(window.videojs.getPlayers())[0];
              if (vjsPlayer) vjsPlayer.currentTime(seekTo);
            }
          } catch (_) {}
          log(`Seeked to ${seekTo.toFixed(1)}s`);

          // Listen for end
          const onEnded = async () => {
            video.removeEventListener('ended', onEnded);
            log('Video ended. Waiting 2s...');
            await sleep(2000);
            done('video_done');
          };
          video.addEventListener('ended', onEnded);

          // Safety: if still not resolved 12s after seek, force advance
          setTimeout(async () => {
            video.removeEventListener('ended', onEnded);
            if (!resolved) {
              log('Safety timeout — advancing anyway');
              await sleep(1500);
              done('video_timeout');
            }
          }, 12000);

        } else if (elapsed >= maxWaitMs) {
          clearInterval(poll);
          log('No video found — treating as non-video slide content');
          await sleep(2500);
          done('no_video');
        }
      }, pollMs);
    });
  }

  // ─── STEP 5: Click the Next / → button in the viewer ─────────────────────
  // Real DOM (from live inspection):
  //   aria-label="next content"
  //   class="... navigation-btn-frwd navigation-btn ..."
  //   mat-icon text = "arrow_forward_ios"
  async function clickNextButton() {
    // Strategy 1: exact aria-label from real DOM
    const exact = [
      'button[aria-label="next content"]',      // confirmed from live DOM
      'button.navigation-btn-frwd',             // confirmed class from live DOM
      'button[aria-label="Next Content"]',      // capitalisation variant
      'button[aria-label="next"]',
      'button[aria-label="Next"]',
    ];

    for (const sel of exact) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
        log(`Clicking Next via "${sel}"`);
        btn.click();
        await sleep(3000);
        return true;
      }
    }

    // Strategy 2: mat-icon text = arrow_forward_ios (real icon from live DOM)
    const allBtns = [...document.querySelectorAll('button')];
    for (const btn of allBtns) {
      if (btn.disabled || btn.hasAttribute('disabled')) continue;
      const icon = btn.querySelector('mat-icon');
      if (!icon) continue;
      const iconText = icon.textContent.trim();
      if (iconText === 'arrow_forward_ios' || iconText === 'chevron_right' || iconText === 'navigate_next' || iconText === 'arrow_forward') {
        const rect = btn.getBoundingClientRect();
        // Must be on the right half of the screen (not sidebar arrows)
        if (rect.left > window.innerWidth * 0.35 && rect.width < 80) {
          log(`Clicking Next via icon "${iconText}" at x=${rect.left}`);
          btn.click();
          await sleep(3000);
          return true;
        }
      }
    }

    log('Next button not found — lesson may have auto-advanced');
    return false;
  }

  // ─── Main automation loop ─────────────────────────────────────────────────
  async function runAutomation() {
    if (!ON_VIEWER_PAGE) {
      sendStatus({
        status: 'error',
        message: 'Please navigate to a course player page first (the URL should contain /viewer/).',
      });
      isRunning = false;
      return;
    }

    log('▶ Automation started');
    isRunning = true;
    isPaused  = false;

    sendStatus({ status: 'running', message: 'Opening Contents tab...' });

    // 1. Open Contents tab
    await openContentsTab();
    await sleep(1000);

    // 2. Expand all folders
    await expandAllFolders();

    // 3. Collect lessons
    const lessons = collectLessons();
    log(`${lessons.length} lesson items found`);

    if (lessons.length === 0) {
      sendStatus({
        status: 'error',
        message: 'No lessons found in the sidebar. Open the Contents tab manually then try again.',
      });
      isRunning = false;
      return;
    }

    let completed = 0;
    let skipped   = 0;
    const total   = lessons.length;

    for (let i = 0; i < lessons.length; i++) {
      if (!isRunning) break;
      while (isPaused) { await sleep(400); }

      const lesson = lessons[i];
      const title  = lesson.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);

      // Skip assignments
      if (isAssignment(lesson)) {
        log(`⏭ Skipping assignment: "${title}"`);
        skipped++;
        sendStatus({ status: 'running', message: `Skipping: ${title}`, completed, total, skipped });
        continue;
      }

      // Skip already-completed
      if (isCompleted(lesson)) {
        log(`✓ Already done: "${title}"`);
        completed++;
        sendStatus({ status: 'running', message: `Already done: ${title}`, completed, total, skipped });
        continue;
      }

      log(`▶ [${i + 1}/${total}] "${title}"`);
      sendStatus({ status: 'running', message: `[${i + 1}/${total}] ${title}`, completed, total, skipped });

      // Click the lesson in the sidebar
      lesson.click();
      await sleep(2800); // allow SPA to load content

      // Handle video / non-video
      await handleVideoContent();

      // Click Next to confirm completion
      await clickNextButton();

      completed++;
      sendStatus({ status: 'running', message: `✓ Done: ${title}`, completed, total, skipped });

      // Short breathe between lessons
      await sleep(1200);
    }

    // ── Finished ──
    isRunning = false;
    const msg = `🎉 All done! Completed ${completed}, skipped ${skipped} assignment(s).`;
    log(msg);
    sendStatus({ status: 'done', message: msg, completed, total, skipped });
  }

  // ─── Message listener ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
      case 'START':
        if (!isRunning) runAutomation();
        sendResponse({ ok: true, onViewerPage: ON_VIEWER_PAGE });
        break;
      case 'PAUSE':
        isPaused = true;
        sendStatus({ status: 'paused', message: 'Paused.' });
        sendResponse({ ok: true });
        break;
      case 'RESUME':
        isPaused = false;
        sendStatus({ status: 'running', message: 'Resumed.' });
        sendResponse({ ok: true });
        break;
      case 'STOP':
        isRunning = false;
        isPaused  = false;
        sendStatus({ status: 'stopped', message: 'Stopped.' });
        sendResponse({ ok: true });
        break;
      case 'GET_STATUS':
        sendResponse({ isRunning, isPaused, onViewerPage: ON_VIEWER_PAGE });
        break;
      default:
        break;
    }
    return true;
  });

  log(`Content script ready (viewer page: ${ON_VIEWER_PAGE})`);
})();
