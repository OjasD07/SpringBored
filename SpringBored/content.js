// SpringBored - Content Script v2
// Targets: infyspringboard.onwingspan.com/web/en/viewer/*

(function () {
  'use strict';

  if (window.__SPRINGBORED_COURSE_LOADED__) return;
  window.__SPRINGBORED_COURSE_LOADED__ = true;

  // ─── GUARD: Only run on actual course viewer pages ────────────────────────
  // The viewer URL always contains /viewer/ — we must not touch the home page
  const ON_VIEWER_PAGE = /\/viewer\//.test(window.location.pathname);

  // ─── State ────────────────────────────────────────────────────────────────
  let isRunning = false;
  let isPaused  = false;

  // Keep the last progress numbers so pause/resume/stop updates do not make the
  // popup hide its progress panel.
  let lastProgress = { completed: 0, total: 0, skipped: 0 };

  // ─── Utils ────────────────────────────────────────────────────────────────
  const log = (msg) => console.log(`%c[SpringBored] ${msg}`, 'color:#e4601e;font-weight:bold');

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /** Wait until the run is resumed, or return immediately when it is stopped. */
  async function waitWhilePaused() {
    while (isRunning && isPaused) {
      await sleep(400);
    }
    return isRunning;
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
    if (Number.isFinite(data.total) && data.total > 0) {
      lastProgress = {
        completed: Number.isFinite(data.completed) ? data.completed : lastProgress.completed,
        total: data.total,
        skipped: Number.isFinite(data.skipped) ? data.skipped : lastProgress.skipped
      };
    }

    const payload = { ...data };
    if (payload.total === undefined && lastProgress.total > 0) {
      payload.completed = Number.isFinite(payload.completed) ? payload.completed : lastProgress.completed;
      payload.total = lastProgress.total;
      payload.skipped = Number.isFinite(payload.skipped) ? payload.skipped : lastProgress.skipped;
    }

    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', ...payload }).catch(() => {});
  }

  // ─── STEP 1: Open the Contents / TOC sidebar tab ──────────────────────────
  // Target the "Contents" tab shown in the top-right tab bar ([AI] [Contents] [Book])
  async function openContentsTab() {
    log('Ensuring Contents tab is open...');

    const allTabEls = [
      ...document.querySelectorAll('[role="tab"], .mat-tab-label, .mat-tab-label-content, button')
    ];

    for (const el of allTabEls) {
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const cls = (el.className?.toString() || '').toLowerCase();
      // Never click next/prev navigation buttons
      if (aria.includes('next') || aria.includes('prev') || cls.includes('navigation-btn')) continue;

      const text = (el.textContent || '').trim();
      if (/^contents?$/i.test(text) || /^contents?$/i.test(aria) || (text.toLowerCase().startsWith('content') && text.length < 15)) {
        const tab = el.closest('[role="tab"], .mat-tab-label') || el;
        const isSelected = tab.getAttribute('aria-selected') === 'true' || tab.classList.contains('mat-tab-label-active');
        if (!isSelected) {
          log('Clicking Contents tab: ' + text);
          tab.click();
          await sleep(1000);
        } else {
          log('Contents tab is already active');
        }
        return true;
      }
    }

    log('Contents tab not found — assuming already visible');
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
      if (!isRunning || isPaused) break;
      const collapsedFolders = [...toc.querySelectorAll(
        'mat-tree-node.ws-player-tree-node[aria-expanded="false"]'
      )].filter(node => !!node.querySelector('mat-icon.toc-expand-icon'));

      if (collapsedFolders.length === 0) break;
      log(`Pass ${pass + 1}: expanding ${collapsedFolders.length} folder(s)`);

      for (const folder of collapsedFolders) {
        if (!isRunning || isPaused) break;
        const toggle = folder.querySelector('mat-icon.toc-expand-icon, button') || folder;
        toggle.click();
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
    if (!el) return false;

    // If it has a pending "Mark as Complete" button, it is NOT completed yet!
    const markBtn = el.querySelector(
      'button[mattooltip*="complete" i], ' +
      'button[aria-label*="complete" i], ' +
      '[mattooltip="Mark as Complete"], ' +
      '[aria-label="Mark as Complete"], ' +
      '[title="Mark as Complete"]'
    );
    if (markBtn) return false;

    // Real DOM: completed nodes get a checkmark icon or completed status
    const cls = (el.className?.toString() || '').toLowerCase();
    const hasCompletedBadge = !!el.querySelector(
      'mat-icon.tick, mat-icon.done, .status-completed, .item-completed, ' +
      'ws-viewer-icon[status="completed"], [data-status="completed"]'
    );

    return (
      hasCompletedBadge ||
      cls.includes('is-completed') ||
      cls.includes('ws-player-tree-node-completed') ||
      el.getAttribute('data-status') === 'completed'
    );
  }

  // ─── STEP 4A: Confirm "Mark as complete" dialog if present ───────────────
  async function confirmDialogIfPresent() {
    const dialogs = [
      ...document.querySelectorAll('mat-dialog-container, [role="dialog"], .mat-dialog-container, .cdk-overlay-pane')
    ];

    for (const dialog of dialogs) {
      const rect = dialog.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const dialogText = (dialog.textContent || '').toLowerCase();
      if (
        dialogText.includes('mark as complete') ||
        dialogText.includes('learning content') ||
        dialogText.includes('learning duration') ||
        dialogText.includes('confirm')
      ) {
        log('Detected "Mark as complete" confirmation dialog');

        const buttons = [...dialog.querySelectorAll('button, [role="button"]')];

        // 1. Look for the button explicitly stating "Mark as complete" or "Mark as..."
        for (const btn of buttons) {
          if (btn.disabled || btn.hasAttribute('disabled')) continue;
          const text = (btn.textContent || '').trim();
          if (/^mark\s*(as)?/i.test(text) || /confirm/i.test(text) || /yes/i.test(text)) {
            log(`Clicking confirmation dialog button: "${text}"`);
            btn.click();
            await sleep(1000);
            return true;
          }
        }

        // 2. If no explicit text, find the primary/accent button that is not "Cancel"
        const confirmBtn = buttons.find(b => {
          if (b.disabled || b.hasAttribute('disabled')) return false;
          const text = (b.textContent || '').trim().toLowerCase();
          return !text.includes('cancel') && !text.includes('close') && !text.includes('dismiss');
        });

        if (confirmBtn) {
          log(`Clicking non-cancel dialog button: "${confirmBtn.textContent.trim()}"`);
          confirmBtn.click();
          await sleep(1000);
          return true;
        }
      }
    }

    return false;
  }

  // ─── STEP 4B: Mark non-video / text / web-module content as complete ──────
  async function markContentAsComplete(lessonNode) {
    // 0. If a confirmation dialog is ALREADY open, confirm it immediately!
    if (await confirmDialogIfPresent()) {
      return true;
    }

    log('Checking for "Mark as Complete" button...');

    // Collect candidate scopes: current tree node, active node, TOC, and document
    const candidateScopes = [];
    if (lessonNode) candidateScopes.push(lessonNode);

    const activeNode = document.querySelector(
      'mat-tree-node.ws-player-tree-node.active, ' +
      'mat-tree-node.ws-player-tree-node[aria-selected="true"], ' +
      'mat-tree-node.ws-player-tree-node.mat-tree-node-selected'
    );
    if (activeNode && activeNode !== lessonNode) candidateScopes.push(activeNode);

    const toc = document.querySelector('.viewer-toc-container, .toc-container');
    if (toc) candidateScopes.push(toc);

    candidateScopes.push(document);

    let clicked = false;

    // 1. Search by tooltips, aria-labels, titles, and text
    for (const scope of candidateScopes) {
      if (clicked) break;
      const candidates = [
        ...scope.querySelectorAll('button, [role="button"], mat-icon, ws-viewer-icon, a')
      ];

      for (const el of candidates) {
        if (el.disabled || el.hasAttribute('disabled')) continue;

        const tip   = (el.getAttribute('mattooltip') || el.getAttribute('mat-tooltip') || '').trim();
        const aria  = (el.getAttribute('aria-label') || '').trim();
        const title = (el.getAttribute('title') || '').trim();
        const text  = (el.textContent || '').trim();

        // Avoid matching "Cancel" or buttons inside unrelated dialogs
        if (/cancel/i.test(text) || /cancel/i.test(aria)) continue;

        if (
          /mark.*complete/i.test(tip)   ||
          /mark.*complete/i.test(aria)  ||
          /mark.*complete/i.test(title) ||
          /mark (as )?complete/i.test(text)
        ) {
          log(`Clicking "Mark as Complete" button (tip="${tip}", aria="${aria}", text="${text}")`);
          const clickTarget = el.closest('button, [role="button"]') || el;
          clickTarget.click();
          clicked = true;
          break;
        }
      }
    }

    // 2. Fallback: check if the lessonNode has an action button with check/done icon
    if (!clicked && lessonNode) {
      const buttons = [...lessonNode.querySelectorAll('button, [role="button"]')];
      for (const btn of buttons) {
        if (btn.disabled || btn.hasAttribute('disabled')) continue;
        const icon = btn.querySelector('mat-icon');
        const iconName = (icon?.textContent || '').trim().toLowerCase();
        if (iconName === 'done' || iconName === 'done_all' || iconName === 'check' || iconName === 'check_circle') {
          log(`Clicking lesson action button with icon "${iconName}"`);
          btn.click();
          clicked = true;
          break;
        }
      }
    }

    if (clicked) {
      // 3. Wait for confirmation dialog to appear and click confirm!
      for (let attempt = 0; attempt < 8; attempt++) {
        await sleep(200);
        const confirmed = await confirmDialogIfPresent();
        if (confirmed) {
          log('Confirmation dialog handled');
          return true;
        }
      }
      return true;
    }

    return false;
  }

  // ─── STEP 4: Handle video or text / web-module content ───────────────────
  // Seek to end for video, or click "Mark as Complete" for reading content.
  // Resolves with a short reason string; "paused" and "stopped" mean the caller
  // must NOT advance to the next lesson.
  async function handleContent(lessonNode) {
    if (!isRunning) return 'stopped';
    if (isPaused) return 'paused';

    // 1. Check right away if this reading material has a "Mark as Complete" button
    if (await markContentAsComplete(lessonNode)) {
      log('Content marked as completed via button');
      return 'marked_complete';
    }

    const pollMs = 150;
    const maxWaitMs = 6000; // 6s max before assuming static slide content
    let elapsed = 0;
    let nextMarkCheck = 450;

    while (isRunning) {
      if (isPaused) {
        try { document.querySelector('video')?.pause(); } catch (_) {}
        return 'paused';
      }

      elapsed += pollMs;

      // Re-check for Mark as Complete during the first 2.5 seconds.
      if (elapsed <= 2500 && elapsed >= nextMarkCheck) {
        nextMarkCheck += 450;
        if (await markContentAsComplete(lessonNode)) {
          log('Content marked as completed via button (after mount)');
          return 'marked_complete';
        }
      }

      const video = document.querySelector('video');

      if (video && video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0) {
        // A previous lesson's ended video can still be mounted briefly. Give the
        // new lesson time to replace it before treating it as this lesson's video.
        if (video.ended && video.currentTime >= video.duration - 0.5 && elapsed < 3500) {
          await sleep(pollMs);
          continue;
        }

        const dur = video.duration;
        log(`Video ready. Duration=${dur.toFixed(1)}s`);

        video.muted = true;
        try { video.playbackRate = 16; } catch (_) {}

        if (video.paused) {
          try { await video.play(); } catch (_) {}
        }

        const seekTo = Math.max(0, dur - 3);
        await sleep(150);

        if (!isRunning) return 'stopped';
        if (isPaused) {
          try { video.pause(); } catch (_) {}
          return 'paused';
        }

        // Video.js wraps the native <video>. Setting currentTime on the native
        // element works, but use the player API too when it is available.
        video.currentTime = seekTo;
        try {
          if (window.videojs) {
            const players = window.videojs.getPlayers && window.videojs.getPlayers();
            const vjsPlayer = players && Object.values(players)[0];
            if (vjsPlayer) vjsPlayer.currentTime(seekTo);
          }
        } catch (_) {}
        log(`Seeked to ${seekTo.toFixed(1)}s`);

        return await waitForVideoEnd(video);
      }

      if (elapsed >= maxWaitMs) {
        // Final check for Mark as Complete before giving up.
        if (await markContentAsComplete(lessonNode)) {
          return 'marked_complete';
        }
        log('No video or complete button found — treating as non-video slide content');
        await sleep(1000);
        return isRunning ? 'no_video' : 'stopped';
      }

      await sleep(pollMs);
    }

    return 'stopped';
  }

  /** Poll a playing video instead of leaving a timer/listener behind. */
  async function waitForVideoEnd(video) {
    const timeoutAt = Date.now() + 10000;

    while (isRunning) {
      if (isPaused) {
        try { video.pause(); } catch (_) {}
        return 'paused';
      }

      const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
      if (video.ended || video.currentTime >= duration - 0.25) {
        log('Video ended. Registering completion (1s)...');
        await sleep(1000);
        return isRunning ? 'video_done' : 'stopped';
      }

      if (Date.now() >= timeoutAt) {
        log('Video end timeout — advancing anyway');
        await sleep(1000);
        return isRunning ? 'video_timeout' : 'stopped';
      }

      await sleep(200);
    }

    return 'stopped';
  }

  // ─── STEP 5: Click the Next / → button in the viewer ─────────────────────
  // Real DOM (from live inspection):
  //   aria-label="next content"
  //   class="... navigation-btn-frwd navigation-btn ..."
  //   mat-icon text = "arrow_forward_ios"
  async function clickNextButton() {
    if (!isRunning || isPaused) return false;

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
        await sleep(800);
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
          await sleep(800);
          return true;
        }
      }
    }

    log('Next button not found — lesson may have auto-advanced');
    return false;
  }

  /** Extract a human title without tree icons/status text. */
  function lessonTitle(lesson) {
    const label = (lesson.getAttribute('aria-label') || lesson.getAttribute('title') || '').trim();
    const titleEl = lesson.querySelector(
      '.ws-player-tree-node-title, .toc-item-title, .tree-node-title, [class*="node-title"], [class*="item-title"]'
    );
    const raw = label || (titleEl?.textContent || lesson.innerText || lesson.textContent || '').trim();

    return raw
      .split('\n')
      .map(s => s.trim())
      .find(Boolean)
      ?.replace(/\b[a-z]+(?:_[a-z]+)+\b/gi, ' ') // material icon ligatures, e.g. play_circle
      .replace(/\b\d{1,3}\s*%/g, '')
      .replace(/\b(completed|complete|in progress|not started|started)\b/gi, '')
      .replace(/^(check|done|lock|task_alt|verified)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || '';
  }

  /** Stable-ish key for a lesson across Angular re-renders. */
  function lessonKey(lesson, occurrenceMap) {
    const title = lessonTitle(lesson);
    const base = lesson.id ? `id:${lesson.id}` : `title:${title}`;
    const occurrence = occurrenceMap.get(base) || 0;
    occurrenceMap.set(base, occurrence + 1);
    return `${base}#${occurrence}`;
  }

  function findUnprocessedLesson(lessons, processed) {
    const occurrenceMap = new Map();
    for (const lesson of lessons) {
      const key = lessonKey(lesson, occurrenceMap);
      if (!processed.has(key)) return { lesson, key };
    }
    return null;
  }

  // ─── Main automation loop ─────────────────────────────────────────────────
  async function runAutomation() {
    if (isRunning) return;

    if (!ON_VIEWER_PAGE) {
      sendStatus({
        status: 'error',
        message: 'Please navigate to a course player page first (the URL should contain /viewer/).',
      });
      return;
    }

    log('Automation started');
    isRunning = true;
    isPaused  = false;
    lastProgress = { completed: 0, total: 0, skipped: 0 };

    sendStatus({ status: 'running', message: 'Opening Contents tab...' });

    // 1. Explicitly open Contents tab and ensure it is ready before starting automation
    let tabReady = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      if (!(await waitWhilePaused())) return;
      await openContentsTab();
      await sleep(1000);
      const toc = document.querySelector('.viewer-toc-container, #ws-viewer-toc-tree-parent');
      if (toc) {
        tabReady = true;
        break;
      }
      log(`Waiting for Contents tab to open (attempt ${attempt}/4)...`);
      await sleep(600);
    }

    if (!tabReady) {
      log('Proceeding: TOC container not immediately confirmed');
    }

    sendStatus({ status: 'running', message: 'Scanning course lessons...' });
    await sleep(600);

    // 2. Expand all folders
    await expandAllFolders();

    // 3. Collect lessons
    let lessons = collectLessons();
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
    const processed = new Set();
    let emptyPasses = 0;

    while (isRunning) {
      if (!(await waitWhilePaused())) break;

      // Refresh on every pass. Angular re-creates tree nodes as lessons change,
      // so a reference captured at the start can point at a detached element.
      lessons = collectLessons();
      let next = findUnprocessedLesson(lessons, processed);

      if (!next) {
        // Newly revealed folders can add lessons after the first expansion.
        if (lessons.length === 0 && emptyPasses < 3) {
          emptyPasses++;
          await sleep(800);
          continue;
        }
        await expandAllFolders();
        lessons = collectLessons();
        next = findUnprocessedLesson(lessons, processed);

        if (!next && emptyPasses < 1) {
          emptyPasses++;
          await sleep(800);
          continue;
        }
      }

      if (!next) break;
      emptyPasses = 0;

      const { lesson, key } = next;
      const title = lessonTitle(lesson).replace(/\s+/g, ' ').slice(0, 60) || 'Untitled lesson';
      const total = Math.max(lessons.length, processed.size + 1);

      // Skip assignments
      if (isAssignment(lesson)) {
        log(`Skipping assignment: "${title}"`);
        processed.add(key);
        skipped++;
        sendStatus({ status: 'running', message: `Skipping: ${title}`, completed, total, skipped });
        continue;
      }

      // Skip already-completed
      if (isCompleted(lesson)) {
        log(`Already complete: "${title}"`);
        processed.add(key);
        completed++;
        sendStatus({ status: 'running', message: `Already complete: ${title}`, completed, total, skipped });
        continue;
      }

      if (!(await waitWhilePaused())) break;

      log(`[${processed.size + 1}/${total}] "${title}"`);
      sendStatus({ status: 'running', message: `[${processed.size + 1}/${total}] ${title}`, completed, total, skipped });

      // Check if clicking Next already loaded and selected this lesson
      const isAlreadyActive =
        lesson.getAttribute('aria-selected') === 'true' ||
        lesson.classList.contains('active') ||
        lesson.classList.contains('mat-tree-node-selected') ||
        lesson.classList.contains('ws-player-tree-node-active');

      if (!isAlreadyActive) {
        // Click the lesson in the sidebar
        try { lesson.scrollIntoView({ block: 'nearest' }); } catch (_) {}
        lesson.click();
        await sleep(600); // allow SPA to start loading content
      } else {
        log(`Lesson already active via Next navigation: "${title}"`);
        await sleep(150);
      }

      if (!isRunning) break;
      if (isPaused) continue;

      // Handle video / text / web-module / mark-as-complete
      const outcome = await handleContent(lesson);

      if (outcome === 'stopped') break;
      // Do not count or advance a lesson that was paused mid-way. On resume the
      // refreshed list selects it again.
      if (outcome === 'paused' || isPaused) continue;
      if (!isRunning) break;

      // Click Next to confirm completion
      await clickNextButton();
      if (!isRunning) break;

      processed.add(key);
      completed++;
      sendStatus({ status: 'running', message: `Done: ${title}`, completed, total, skipped });

      // Short breathe between lessons
      await sleep(250);
    }

    // STOP already sent its own status. Only announce completion when the loop
    // ran out of lessons on its own.
    if (isRunning) {
      isRunning = false;
      const msg = `Complete. ${completed} lesson(s) done, ${skipped} assignment(s) skipped.`;
      log(msg);
      sendStatus({ status: 'done', message: msg, completed, total: Math.max(lessons.length, processed.size), skipped });
    }
  }

  // ─── Message listener ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
      case 'START':
        if (!isRunning) runAutomation();
        sendResponse({ ok: true, onViewerPage: ON_VIEWER_PAGE });
        break;
      case 'PAUSE':
        if (isRunning && !isPaused) {
          isPaused = true;
          sendStatus({ status: 'paused', message: 'Paused.' });
        }
        sendResponse({ ok: true });
        break;
      case 'RESUME':
        if (isRunning && isPaused) {
          isPaused = false;
          sendStatus({ status: 'running', message: 'Resumed.' });
        }
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
