// SpringBored - Content Script
// Runs on Infosys Springboard pages and handles course automation

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────
  let isRunning = false;
  let isPaused = false;
  let currentLessonIndex = 0;
  let lessons = [];
  let videoCheckInterval = null;
  let statusCallback = null;

  // ─── Logger ──────────────────────────────────────────────────────────────
  function log(msg) {
    console.log(`[SpringBored] ${msg}`);
  }

  // ─── Utility: sleep ──────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Utility: wait for element ───────────────────────────────────────────
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for: ${selector}`));
      }, timeout);
    });
  }

  // ─── Open Contents Tab ────────────────────────────────────────────────────
  async function openContentsTab() {
    log('Looking for Contents tab...');

    // Try multiple selector strategies for the "Contents" tab
    const selectors = [
      'button[aria-label="Contents"]',
      'button.mat-tab-label:not([aria-disabled="true"])',
      '[data-name="contents"]',
      // The tab bar visible in screenshot
      '.viewer-top-icons button',
      'lex-viewer-top-nav button',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.textContent.toLowerCase().includes('content')) {
          el.click();
          log('Clicked Contents tab via: ' + sel);
          await sleep(1500);
          return true;
        }
      }
    }

    // Fallback: look for SVG icon buttons in the top-right nav area
    const buttons = document.querySelectorAll(
      'lex-viewer-top-nav button, .viewer-nav button, .mat-icon-button'
    );
    log(`Found ${buttons.length} nav buttons, inspecting...`);
    for (const btn of buttons) {
      if (
        btn.title?.toLowerCase().includes('content') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('content')
      ) {
        btn.click();
        await sleep(1500);
        return true;
      }
    }

    log('Contents tab not found – may already be open');
    return false;
  }

  // ─── Collect all lesson items from the sidebar ────────────────────────────
  function collectLessons() {
    // Selectors seen on Wingspan/Springboard sidebars
    const itemSelectors = [
      // Module content items (not folder/section headers)
      'lex-toc-item:not(.is-collection)',
      '.lex-toc-item:not([data-type="collection"])',
      '.toc-item-container',
      'ul.toc-list li:not(.toc-section)',
      // Fallback generic
      '.content-item',
    ];

    for (const sel of itemSelectors) {
      const els = [...document.querySelectorAll(sel)];
      if (els.length > 0) {
        log(`Collected ${els.length} lessons via "${sel}"`);
        return els;
      }
    }

    // Deep fallback: scan all sidebar links
    const sidebar = document.querySelector(
      'lex-table-of-contents, .toc-container, .contents-panel, mat-sidenav'
    );
    if (sidebar) {
      const links = [...sidebar.querySelectorAll('a, button, [role="treeitem"]')];
      log(`Fallback: found ${links.length} sidebar items`);
      return links;
    }

    log('No lessons found in sidebar');
    return [];
  }

  // ─── Expand all collapsed folders/modules ────────────────────────────────
  async function expandAllFolders() {
    log('Expanding all folders...');
    const folderSelectors = [
      '.toc-collection-title',
      'lex-toc-collection > button',
      '.toc-folder',
      '[class*="collection"] button',
      'button.module-title',
    ];

    for (const sel of folderSelectors) {
      const folders = [...document.querySelectorAll(sel)];
      for (const folder of folders) {
        const expanded =
          folder.getAttribute('aria-expanded') === 'true' ||
          folder.parentElement?.classList.contains('expanded');
        if (!expanded) {
          folder.click();
          await sleep(400);
        }
      }
    }
    await sleep(800);
  }

  // ─── Check if an item is an assignment ───────────────────────────────────
  function isAssignment(el) {
    const text = el.textContent.toLowerCase();
    const type = el.getAttribute('data-type') || el.getAttribute('data-resource-type') || '';
    return (
      text.includes('assignment') ||
      text.includes('quiz') ||
      text.includes('assessment') ||
      type.includes('assessment') ||
      type.includes('quiz') ||
      el.querySelector('[class*="assessment"], [class*="quiz"]') !== null
    );
  }

  // ─── Check if item already has a completion tick ──────────────────────────
  function isCompleted(el) {
    return (
      el.classList.contains('completed') ||
      el.querySelector('.completed, .tick, [class*="checkmark"], [class*="complete"]') !== null ||
      el.getAttribute('aria-checked') === 'true' ||
      el.querySelector('mat-icon[fonticon="done"], .mat-icon[data-mat-icon-name="done"]') !== null
    );
  }

  // ─── Get the current HTML5 video element ─────────────────────────────────
  function getVideo() {
    return (
      document.querySelector('video') ||
      document.querySelector('lex-player video') ||
      document.querySelector('vg-player video')
    );
  }

  // ─── Handle video lesson: seek near end → wait → move on ─────────────────
  function waitForVideoAndAdvance() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max wait

      const poll = setInterval(async () => {
        if (!isRunning || isPaused) {
          clearInterval(poll);
          return resolve('paused');
        }

        attempts++;
        const video = getVideo();

        if (video && video.readyState >= 2 && video.duration > 0) {
          clearInterval(poll);

          const duration = video.duration;
          log(`Video found. Duration: ${duration.toFixed(1)}s`);

          // Set playback rate to 16x for speed
          video.playbackRate = 16;
          video.muted = true;

          // If video hasn't started, play it
          if (video.paused) {
            try { await video.play(); } catch (_) { /* autoplay blocked, handled below */ }
          }

          // Seek to (duration - 3) so we're 3 seconds from end
          const targetTime = Math.max(0, duration - 3);
          log(`Seeking to ${targetTime.toFixed(1)}s (3s before end)`);

          // Small delay to ensure video state is ready before seeking
          await sleep(500);
          video.currentTime = targetTime;

          // Wait for "ended" event or near-end detection
          const endHandler = async () => {
            video.removeEventListener('ended', endHandler);
            log('Video ended. Waiting 2s before advancing...');
            await sleep(2000);
            resolve('video_done');
          };

          video.addEventListener('ended', endHandler);

          // Safety net: if video doesn't fire 'ended' within 10s after seek, advance anyway
          setTimeout(async () => {
            video.removeEventListener('ended', endHandler);
            if (video.currentTime >= duration - 1 || video.ended) {
              log('Safety net: video near/at end. Advancing...');
              await sleep(2000);
              resolve('video_done');
            }
          }, 10000);

        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          log('No video found after 30s, treating as non-video content...');
          await sleep(3000); // Wait a bit for non-video slides/articles
          resolve('no_video');
        }
      }, 500);
    });
  }

  // ─── Click the "Next" button in the viewer ───────────────────────────────
  async function clickNext() {
    const nextSelectors = [
      'button[aria-label="Next"]',
      'button[title="Next"]',
      '.next-btn',
      'lex-player-actions button:last-child',
      '.player-next-button',
      'button.go-next',
      '[class*="next-button"]',
      'button > .mat-icon[data-mat-icon-name="chevron_right"]',
    ];

    for (const sel of nextSelectors) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) {
        log('Clicking Next via: ' + sel);
        btn.click();
        await sleep(2500);
        return true;
      }
    }

    // Fallback: right arrow icon buttons at the edge of the viewer
    const chevrons = [...document.querySelectorAll('button')].filter(b => {
      const icon = b.querySelector('mat-icon, i');
      if (icon) {
        return (
          icon.textContent.trim() === 'chevron_right' ||
          icon.textContent.trim() === 'navigate_next' ||
          icon.className.includes('right') ||
          icon.className.includes('next')
        );
      }
      return b.textContent.trim() === '›' || b.textContent.trim() === '→';
    });

    if (chevrons.length > 0) {
      chevrons[chevrons.length - 1].click();
      log('Clicked next via chevron button');
      await sleep(2500);
      return true;
    }

    log('Next button not found');
    return false;
  }

  // ─── Send status update to popup ─────────────────────────────────────────
  function sendStatus(data) {
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', ...data }).catch(() => {});
  }

  // ─── Main automation loop ────────────────────────────────────────────────
  async function runAutomation() {
    log('Starting SpringBored automation...');
    isRunning = true;
    isPaused = false;

    sendStatus({ status: 'running', message: 'Opening Contents tab...' });

    // Step 1: Open the Contents tab
    await openContentsTab();
    await sleep(1000);

    // Step 2: Expand all folders/modules
    await expandAllFolders();

    // Step 3: Collect all lessons
    lessons = collectLessons();
    log(`Found ${lessons.length} total items in sidebar`);

    if (lessons.length === 0) {
      sendStatus({ status: 'error', message: 'No lessons found. Make sure you are on a course page.' });
      isRunning = false;
      return;
    }

    // Step 4: Iterate through each lesson
    let completed = 0;
    let skipped = 0;

    for (let i = 0; i < lessons.length; i++) {
      if (!isRunning) break;

      while (isPaused) {
        await sleep(500);
      }

      const lesson = lessons[i];
      const title = lesson.textContent.trim().slice(0, 60);

      // Skip assignments
      if (isAssignment(lesson)) {
        log(`Skipping assignment: "${title}"`);
        skipped++;
        sendStatus({
          status: 'running',
          message: `Skipping assignment: ${title}`,
          completed,
          total: lessons.length,
          skipped,
        });
        continue;
      }

      // Skip already-completed lessons
      if (isCompleted(lesson)) {
        log(`Already completed: "${title}"`);
        completed++;
        sendStatus({
          status: 'running',
          message: `Already done: ${title}`,
          completed,
          total: lessons.length,
          skipped,
        });
        continue;
      }

      log(`Opening lesson [${i + 1}/${lessons.length}]: "${title}"`);
      sendStatus({
        status: 'running',
        message: `Lesson ${i + 1}/${lessons.length}: ${title}`,
        completed,
        total: lessons.length,
        skipped,
      });

      // Click the lesson in the sidebar
      lesson.click();
      await sleep(2500); // Wait for content to load

      // Handle the content
      const result = await waitForVideoAndAdvance();
      log(`Lesson result: ${result}`);

      // Click "Next" to mark as complete and move on
      await clickNext();

      completed++;
      sendStatus({
        status: 'running',
        message: `Completed: ${title}`,
        completed,
        total: lessons.length,
        skipped,
      });

      // Brief pause between lessons
      await sleep(1500);
    }

    // Done
    log('All lessons processed!');
    sendStatus({
      status: 'done',
      message: `Done! Completed ${completed} lessons, skipped ${skipped} assignments.`,
      completed,
      total: lessons.length,
      skipped,
    });
    isRunning = false;
  }

  // ─── Message listener from popup/background ───────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
      case 'START':
        if (!isRunning) {
          runAutomation();
        }
        sendResponse({ ok: true });
        break;

      case 'PAUSE':
        isPaused = true;
        sendStatus({ status: 'paused', message: 'Paused by user.' });
        sendResponse({ ok: true });
        break;

      case 'RESUME':
        isPaused = false;
        sendStatus({ status: 'running', message: 'Resumed.' });
        sendResponse({ ok: true });
        break;

      case 'STOP':
        isRunning = false;
        isPaused = false;
        sendStatus({ status: 'stopped', message: 'Stopped by user.' });
        sendResponse({ ok: true });
        break;

      case 'GET_STATUS':
        sendResponse({ isRunning, isPaused });
        break;

      default:
        break;
    }
    return true; // Keep channel open for async
  });

  log('Content script loaded and ready.');
})();
