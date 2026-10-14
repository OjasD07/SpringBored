// SpringBored (Assignment Edition) - Content Script v2.2.1
// Autonomous Quiz, Test, and Multi-Section Assessment (IAP) Solver
// Powered by Google Gemini 3.8 Flash.

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let isRunning = false;
  let isPaused  = false;

  // ─── Logging & Utilities ──────────────────────────────────────────────────
  const log = (msg) => console.log(`%c[SpringBored Assignment] ${msg}`, 'color:#a855f7;font-weight:bold');

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ─── Multi-Frame Document Crawler ─────────────────────────────────────────
  /** Retrieves document and all accessible child iframes in the window tree */
  function getActiveDocuments() {
    const docs = [document];
    try {
      const iframes = [...document.querySelectorAll('iframe')];
      for (const f of iframes) {
        try {
          if (f.contentDocument && !docs.includes(f.contentDocument)) {
            docs.push(f.contentDocument);
            try {
              const nested = [...f.contentDocument.querySelectorAll('iframe')];
              for (const nf of nested) {
                if (nf.contentDocument && !docs.includes(nf.contentDocument)) {
                  docs.push(nf.contentDocument);
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}
    return docs;
  }

  // ─── Assessment Context Detection ─────────────────────────────────────────
  function hasAssessmentDom() {
    const docs = getActiveDocuments();
    for (const d of docs) {
      if (findAttemptSectionButtons([d]).length > 0) return true;
      if (findStartButtons([d]).length > 0) return true;
      if (findSaveButton([d])) return true;
      if (d.querySelector('input[type="radio"], [role="radio"], mat-radio-button, .circle, .q-num')) return true;

      const txt = (d.body?.textContent || '').toLowerCase();
      if (
        txt.includes('objective questions') ||
        txt.includes('attempt section') ||
        txt.includes('0 of 25 attempted') ||
        txt.includes('finish test') ||
        txt.includes('expand/collapse all sections') ||
        txt.includes('total duration of the test')
      ) {
        return true;
      }
    }
    return false;
  }

  // ─── Status Communication ─────────────────────────────────────────────────
  function sendStatus(data) {
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', ...data }).catch(() => {});
    if (data.message && (isRunning || document.getElementById('springbored-assignment-hud'))) {
      const prog = (data.completed !== undefined && data.total) ? `[${data.completed}/${data.total}]` : '';
      createOrUpdateHud(data.message, prog, data.status === 'running');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOATING DRAGGABLE HUD (Bottom-Right by default, never hides Finish button)
  // ═══════════════════════════════════════════════════════════════════════════

  let currentCorner = 'bottom-right';
  let isEnlarged = false;
  let autoScrollLogs = true;
  const aiCommunicationLogs = [];

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderLogCard(feed, entry) {
    if (!feed || !entry) return;
    const card = document.createElement('div');
    const qNum = entry.questionNumber || '?';
    card.id = `sb-hud-card-q${qNum}`;
    card.className = `sb-hud-card ${entry.status === 'success' ? 'success' : 'fallback'}`;

    const optsHtml = (entry.options || []).map((opt, idx) => {
      const isChosen = (entry.selectedIndices || []).includes(idx);
      return `
        <div class="sb-hud-stream-opt ${isChosen ? 'chosen' : ''}">
          <span class="sb-hud-stream-idx">[${idx}]</span>
          <span class="sb-hud-stream-txt">${escapeHtml(opt)}</span>
          ${isChosen ? '<span class="sb-hud-stream-check">✓ SELECTED</span>' : ''}
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="sb-hud-card-top">
        <div class="sb-hud-card-qinfo">
          <span class="sb-hud-card-qbadge">Question #${qNum}</span>
          <span class="sb-hud-card-time">${entry.timestamp || ''}</span>
        </div>
        <div class="sb-hud-card-perf">
          <span class="sb-hud-card-latency">⚡ ${entry.latencyMs || 0}ms</span>
          <span class="sb-hud-card-model">${entry.model || 'gemini-2.0-flash'}</span>
        </div>
      </div>

      <div class="sb-hud-card-prompt">
        <div class="sb-hud-sublabel">PROMPT SENT TO GEMINI:</div>
        <div class="sb-hud-prompt-text">${escapeHtml(entry.questionText || '')}</div>
      </div>

      <div class="sb-hud-card-options">
        ${optsHtml}
      </div>

      <div class="sb-hud-card-reply">
        <div class="sb-hud-sublabel">GEMINI AI RESPONSE:</div>
        <div class="sb-hud-ans-highlight">
          Selected Option: <strong>${escapeHtml(entry.selectedText || `[${(entry.selectedIndices || [0]).join(', ')}]`)}</strong>
        </div>
        ${entry.explanation ? `<div class="sb-hud-exp-text">💡 ${escapeHtml(entry.explanation)}</div>` : ''}
      </div>
    `;

    feed.appendChild(card);
  }

  function updatePillsBar() {
    const pillsBar = document.getElementById('sbHudPillsBar');
    if (!pillsBar) return;
    pillsBar.innerHTML = '';
    aiCommunicationLogs.forEach((entry) => {
      const qNum = entry.questionNumber;
      if (!qNum) return;
      const pill = document.createElement('button');
      pill.className = 'sb-hud-q-pill';
      pill.textContent = `Q${qNum}`;
      pill.title = `Jump to Question ${qNum}`;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = document.getElementById(`sb-hud-card-q${qNum}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          [...pillsBar.querySelectorAll('.sb-hud-q-pill')].forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        }
      });
      pillsBar.appendChild(pill);
    });
  }

  function appendAiCommunicationLog(entry) {
    aiCommunicationLogs.push(entry);
    if (aiCommunicationLogs.length > 50) aiCommunicationLogs.shift();

    const badge = document.getElementById('sbHudStreamBadge');
    if (badge) badge.textContent = String(aiCommunicationLogs.length);

    const feed = document.getElementById('sbHudStreamFeed');
    const placeholder = document.getElementById('sbHudPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    if (feed) {
      renderLogCard(feed, entry);
      updatePillsBar();
      if (autoScrollLogs) {
        feed.scrollTop = feed.scrollHeight;
      }
    }
  }

  function createOrUpdateHud(statusText = 'Ready', progressText = '', isSolving = false) {
    let hud = document.getElementById('springbored-assignment-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'springbored-assignment-hud';
      hud.innerHTML = `
        <div class="sb-hud-bar" id="sbHudBar">
          <div class="sb-hud-header" id="sbHudHeader" title="Drag to move anywhere">
            <div class="sb-hud-brand">
              <span class="sb-hud-sparkle">⚡</span>
              <span class="sb-hud-title">SpringBored AI</span>
              <span class="sb-hud-model" id="sbHudModel">Gemini 2.0 Flash</span>
            </div>
            <div class="sb-hud-header-tools">
              <button class="sb-hud-tool-btn" id="sbHudPosBtn" title="Switch Corner (Bottom-Right / Bottom-Left / Top-Left)">⇋</button>
              <button class="sb-hud-tool-btn" id="sbHudExpandBtn" title="Enlarge & Inspect Live Gemini AI Communication">⤢</button>
              <button class="sb-hud-tool-btn" id="sbHudMinBtn" title="Minimize / Expand">_</button>
              <button class="sb-hud-tool-btn" id="sbHudCloseBtn" title="Close Widget">✕</button>
            </div>
          </div>
          <div class="sb-hud-content" id="sbHudContent">
            <div class="sb-hud-status-row">
              <span class="sb-hud-dot" id="sbHudDot"></span>
              <span class="sb-hud-status" id="sbHudStatus">Ready</span>
              <span class="sb-hud-progress" id="sbHudProg"></span>
            </div>
            <div class="sb-hud-actions">
              <button class="sb-hud-action-btn" id="sbHudActionBtn">
                ⚡ Auto-Solve Assessment Now
              </button>
            </div>
            <div class="sb-hud-stream-toggle-row">
              <button class="sb-hud-stream-toggle-btn" id="sbHudStreamToggleBtn" title="Toggle Live AI Communication Stream">
                <span class="sb-hud-stream-dot">●</span>
                <span>Live Gemini Inspector</span>
                <span class="sb-hud-stream-badge" id="sbHudStreamBadge">0</span>
              </button>
            </div>
            <div class="sb-hud-inspector" id="sbHudInspector" style="display:none;">
              <div class="sb-hud-insp-header">
                <div class="sb-hud-insp-left">
                  <span class="sb-hud-insp-tag">LIVE PROMPT & REPLY STREAM</span>
                </div>
                <div class="sb-hud-insp-right">
                  <button class="sb-hud-insp-subbtn" id="sbHudAutoScrollBtn" title="Auto-scroll to latest answer">↓ Auto</button>
                  <button class="sb-hud-insp-subbtn" id="sbHudClearStreamBtn" title="Clear stream history">Clear</button>
                </div>
              </div>
              <div class="sb-hud-pills-bar" id="sbHudPillsBar"></div>
              <div class="sb-hud-stream-feed" id="sbHudStreamFeed">
                <div class="sb-hud-stream-placeholder" id="sbHudPlaceholder">
                  Questions, prompts, and Gemini AI responses will appear here live during the assessment.
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        #springbored-assignment-hud {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          user-select: none;
          touch-action: none;
        }
        .sb-hud-bar {
          background: rgba(15, 17, 26, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(139, 92, 246, 0.6);
          border-radius: 12px;
          padding: 10px 14px;
          width: 310px;
          box-shadow: 0 10px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(139, 92, 246, 0.35);
          color: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: width 0.25s ease, max-height 0.25s ease;
        }
        #springbored-assignment-hud.sb-hud-enlarged .sb-hud-bar {
          width: 530px;
          max-width: calc(100vw - 36px);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(139, 92, 246, 0.45);
        }
        .sb-hud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: grab;
          padding-bottom: 2px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .sb-hud-header:active {
          cursor: grabbing;
        }
        .sb-hud-brand {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sb-hud-sparkle {
          font-size: 13px;
        }
        .sb-hud-title {
          font-weight: 700;
          font-size: 12.5px;
          letter-spacing: -0.2px;
          background: linear-gradient(135deg, #a78bfa, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .sb-hud-model {
          font-size: 9px;
          font-weight: 600;
          background: rgba(168, 85, 247, 0.22);
          color: #c084fc;
          padding: 2px 6px;
          border-radius: 99px;
          border: 1px solid rgba(168, 85, 247, 0.35);
        }
        .sb-hud-header-tools {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sb-hud-tool-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          padding: 2px 5px;
          border-radius: 4px;
          line-height: 1;
        }
        .sb-hud-tool-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }
        .sb-hud-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sb-hud-status-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }
        .sb-hud-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
          flex-shrink: 0;
        }
        .sb-hud-dot.busy {
          background: #a855f7;
          box-shadow: 0 0 8px #a855f7;
          animation: sb-pulse 1.2s infinite;
        }
        .sb-hud-status {
          color: #cbd5e1;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-hud-progress {
          font-size: 10.5px;
          font-weight: 600;
          color: #38bdf8;
          flex-shrink: 0;
        }
        .sb-hud-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sb-hud-action-btn {
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          border: none;
          border-radius: 8px;
          color: #ffffff;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
        }
        .sb-hud-action-btn:hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
        }
        .sb-hud-action-btn.active {
          background: #ef4444;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }
        .sb-hud-stream-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 2px;
        }
        .sb-hud-stream-toggle-btn {
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #c084fc;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          width: 100%;
          justify-content: center;
          transition: all 0.2s;
        }
        .sb-hud-stream-toggle-btn:hover {
          background: rgba(139, 92, 246, 0.22);
          border-color: rgba(139, 92, 246, 0.5);
          color: #ffffff;
        }
        .sb-hud-stream-dot {
          color: #34d399;
          font-size: 8px;
        }
        .sb-hud-stream-badge {
          background: #7c3aed;
          color: #ffffff;
          padding: 1px 5px;
          border-radius: 99px;
          font-size: 9px;
        }
        .sb-hud-inspector {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          max-height: 380px;
        }
        #springbored-assignment-hud.sb-hud-enlarged .sb-hud-inspector {
          max-height: 560px;
        }
        .sb-hud-insp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2px;
        }
        .sb-hud-insp-tag {
          font-size: 9px;
          font-weight: 700;
          color: #a78bfa;
          letter-spacing: 0.5px;
        }
        .sb-hud-insp-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sb-hud-insp-subbtn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 9.5px;
          cursor: pointer;
        }
        .sb-hud-insp-subbtn:hover {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.35);
        }
        .sb-hud-pills-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          padding: 3px 2px;
          margin-bottom: 2px;
          scrollbar-width: thin;
        }
        .sb-hud-pills-bar::-webkit-scrollbar {
          height: 3px;
        }
        .sb-hud-pills-bar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 99px;
        }
        .sb-hud-q-pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #94a3b8;
          font-size: 9.5px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 99px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .sb-hud-q-pill:hover {
          background: rgba(168, 85, 247, 0.25);
          color: #ffffff;
          border-color: #a855f7;
        }
        .sb-hud-q-pill.active {
          background: #7c3aed;
          color: #ffffff;
          border-color: #a78bfa;
          box-shadow: 0 0 8px rgba(124, 58, 237, 0.5);
        }
        .sb-hud-stream-feed {
          overflow-y: auto;
          max-height: 300px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        #springbored-assignment-hud.sb-hud-enlarged .sb-hud-stream-feed {
          max-height: 470px;
        }
        .sb-hud-stream-feed::-webkit-scrollbar {
          width: 5px;
        }
        .sb-hud-stream-feed::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 99px;
        }
        .sb-hud-stream-placeholder {
          font-size: 10.5px;
          color: #64748b;
          text-align: center;
          padding: 16px 8px;
          font-style: italic;
        }
        .sb-hud-card {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .sb-hud-card.success {
          border-left: 3px solid #34d399;
        }
        .sb-hud-card.fallback {
          border-left: 3px solid #f59e0b;
        }
        .sb-hud-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sb-hud-card-qbadge {
          font-weight: 700;
          color: #c084fc;
          font-size: 11px;
        }
        .sb-hud-card-time {
          font-size: 9.5px;
          color: #64748b;
          margin-left: 6px;
        }
        .sb-hud-card-perf {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sb-hud-card-latency {
          font-size: 9.5px;
          font-family: monospace;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.12);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .sb-hud-card-model {
          font-size: 9px;
          color: #94a3b8;
        }
        .sb-hud-card-prompt {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sb-hud-sublabel {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.3px;
        }
        .sb-hud-prompt-text {
          background: rgba(0, 0, 0, 0.4);
          padding: 6px 8px;
          border-radius: 5px;
          color: #e2e8f0;
          font-size: 10.5px;
          line-height: 1.4;
          white-space: pre-wrap;
          max-height: 90px;
          overflow-y: auto;
        }
        .sb-hud-card-options {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sb-hud-stream-opt {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 3px 6px;
          border-radius: 4px;
          color: #94a3b8;
          font-size: 10px;
          background: rgba(0, 0, 0, 0.18);
        }
        .sb-hud-stream-opt.chosen {
          background: rgba(34, 197, 94, 0.14);
          border: 1px solid rgba(34, 197, 94, 0.35);
          color: #86efac;
          font-weight: 600;
        }
        .sb-hud-stream-idx {
          color: #a855f7;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sb-hud-stream-opt.chosen .sb-hud-stream-idx {
          color: #4ade80;
        }
        .sb-hud-stream-txt {
          flex: 1;
          word-break: break-word;
        }
        .sb-hud-stream-check {
          color: #34d399;
          font-size: 9px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sb-hud-card-reply {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.28);
          border-radius: 6px;
          padding: 7px 9px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sb-hud-ans-highlight {
          color: #ffffff;
          font-size: 11px;
        }
        .sb-hud-ans-highlight strong {
          color: #a78bfa;
        }
        .sb-hud-exp-text {
          color: #cbd5e1;
          font-size: 10px;
          line-height: 1.35;
          font-style: italic;
        }
        @keyframes sb-pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
      (document.body || document.documentElement).appendChild(hud);

      // ── Make HUD Draggable ──
      const header = document.getElementById('sbHudHeader');
      let isDragging = false;
      let startX, startY, origLeft, origTop;

      header.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = hud.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origLeft = rect.left;
        origTop = rect.top;

        // Switch to top/left positioning for exact dragging
        hud.style.bottom = 'auto';
        hud.style.right = 'auto';
        hud.style.left = `${origLeft}px`;
        hud.style.top = `${origTop}px`;
        header.setPointerCapture(e.pointerId);
      });

      header.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const panelWidth = isEnlarged ? 540 : 325;
        const newLeft = Math.max(10, Math.min(window.innerWidth - panelWidth, origLeft + deltaX));
        const newTop  = Math.max(10, Math.min(window.innerHeight - 80, origTop + deltaY));
        hud.style.left = `${newLeft}px`;
        hud.style.top = `${newTop}px`;
      });

      header.addEventListener('pointerup', (e) => {
        isDragging = false;
        try { header.releasePointerCapture(e.pointerId); } catch (_) {}
      });

      // ── Enlarge / Inspector Toggle ──
      const expandBtn = document.getElementById('sbHudExpandBtn');
      const toggleRowBtn = document.getElementById('sbHudStreamToggleBtn');
      const inspector = document.getElementById('sbHudInspector');

      function setEnlarged(enlarged) {
        isEnlarged = enlarged;
        if (isEnlarged) {
          hud.classList.add('sb-hud-enlarged');
          if (inspector) inspector.style.display = 'flex';
          if (expandBtn) {
            expandBtn.textContent = '⤡';
            expandBtn.title = 'Shrink / Compact Window';
          }
          if (toggleRowBtn) {
            toggleRowBtn.style.background = 'rgba(139, 92, 246, 0.25)';
          }
          // Ensure enlarged window does not overflow off right screen edge
          const rect = hud.getBoundingClientRect();
          if (rect.right > window.innerWidth - 10) {
            const curLeft = parseInt(hud.style.left, 10);
            if (!isNaN(curLeft)) {
              hud.style.left = `${Math.max(10, curLeft - (rect.right - window.innerWidth + 20))}px`;
            }
          }
          const feed = document.getElementById('sbHudStreamFeed');
          if (feed && autoScrollLogs) {
            feed.scrollTop = feed.scrollHeight;
          }
        } else {
          hud.classList.remove('sb-hud-enlarged');
          if (inspector) inspector.style.display = 'none';
          if (expandBtn) {
            expandBtn.textContent = '⤢';
            expandBtn.title = 'Enlarge & Inspect Live Gemini AI Communication';
          }
          if (toggleRowBtn) {
            toggleRowBtn.style.background = 'rgba(139, 92, 246, 0.12)';
          }
        }
      }

      if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          setEnlarged(!isEnlarged);
        });
      }

      if (toggleRowBtn) {
        toggleRowBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          setEnlarged(!isEnlarged);
        });
      }

      // Auto-scroll toggle
      const autoScrollBtn = document.getElementById('sbHudAutoScrollBtn');
      if (autoScrollBtn) {
        autoScrollBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          autoScrollLogs = !autoScrollLogs;
          autoScrollBtn.style.color = autoScrollLogs ? '#a855f7' : '#64748b';
          autoScrollBtn.textContent = autoScrollLogs ? '↓ Auto' : 'Paused';
        });
      }

      // Clear logs button
      const clearStreamBtn = document.getElementById('sbHudClearStreamBtn');
      if (clearStreamBtn) {
        clearStreamBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          aiCommunicationLogs.length = 0;
          updatePillsBar();
          const feed = document.getElementById('sbHudStreamFeed');
          if (feed) {
            feed.innerHTML = `
              <div class="sb-hud-stream-placeholder" id="sbHudPlaceholder">
                Logs cleared. New queries will appear here.
              </div>
            `;
          }
          const badge = document.getElementById('sbHudStreamBadge');
          if (badge) badge.textContent = '0';
        });
      }

      // ── Position Flip Button (Bottom-Right -> Bottom-Left -> Top-Left) ──
      const posBtn = document.getElementById('sbHudPosBtn');
      posBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hud.style.left = 'auto';
        hud.style.top = 'auto';
        hud.style.bottom = 'auto';
        hud.style.right = 'auto';

        if (currentCorner === 'bottom-right') {
          currentCorner = 'bottom-left';
          hud.style.bottom = '24px';
          hud.style.left = '24px';
        } else if (currentCorner === 'bottom-left') {
          currentCorner = 'top-left';
          hud.style.top = '24px';
          hud.style.left = '24px';
        } else {
          currentCorner = 'bottom-right';
          hud.style.bottom = '24px';
          hud.style.right = '24px';
        }
      });

      // ── Minimize Button ──
      const minBtn = document.getElementById('sbHudMinBtn');
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const content = document.getElementById('sbHudContent');
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        minBtn.textContent = isHidden ? '_' : '□';
      });

      // ── Close Button ──
      const closeBtn = document.getElementById('sbHudCloseBtn');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hud.remove();
      });

      // ── Action Button ──
      const initActionBtn = document.getElementById('sbHudActionBtn');
      if (initActionBtn) {
        initActionBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isRunning) {
            log('HUD Action Button Clicked! Starting solver...');
            startAssessmentSolver();
          } else {
            isPaused = !isPaused;
            createOrUpdateHud(isPaused ? 'Paused' : 'Solving...', '', !isPaused);
          }
        });
      }

      // Keyboard shortcuts: Alt+S, Ctrl+Shift+S, F2
      window.addEventListener('keydown', (e) => {
        if (
          (e.altKey && e.key.toLowerCase() === 's') ||
          (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') ||
          e.key === 'F2'
        ) {
          e.preventDefault();
          initActionBtn?.click();
        }
      });

      // Re-populate historical stream logs if HUD was newly created
      const streamFeed = document.getElementById('sbHudStreamFeed');
      if (streamFeed && aiCommunicationLogs.length > 0) {
        const placeholder = document.getElementById('sbHudPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        const badge = document.getElementById('sbHudStreamBadge');
        if (badge) badge.textContent = String(aiCommunicationLogs.length);
        for (const item of aiCommunicationLogs) {
          renderLogCard(streamFeed, item);
        }
        updatePillsBar();
      }
    }

    const statusEl = document.getElementById('sbHudStatus');
    const progEl = document.getElementById('sbHudProg');
    const dotEl = document.getElementById('sbHudDot');
    const actionBtn = document.getElementById('sbHudActionBtn');
    const modelEl = document.getElementById('sbHudModel');

    chrome.storage.local.get(['geminiModel'], (d) => {
      if (modelEl && d.geminiModel) {
        let m = d.geminiModel;
        if (m.toLowerCase().startsWith('gemini-2.0-flash')) m = 'Gemini 2.0 Flash';
        else if (m.toLowerCase().startsWith('gemini-1.5-flash')) m = 'Gemini 1.5 Flash';
        modelEl.textContent = m;
      }
    });

    if (statusEl && statusText) statusEl.textContent = statusText;
    if (progEl) progEl.textContent = progressText;
    if (dotEl) dotEl.className = isSolving ? 'sb-hud-dot busy' : 'sb-hud-dot';
    if (actionBtn) {
      if (isSolving) {
        actionBtn.textContent = '⏸ Pause AI Solving';
        actionBtn.className = 'sb-hud-action-btn active';
      } else {
        actionBtn.textContent = '⚡ Auto-Solve Assessment Now';
        actionBtn.className = 'sb-hud-action-btn';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPREHENSIVE ELEMENT SEARCHERS (Searches main doc & child iframes)
  // ═══════════════════════════════════════════════════════════════════════════

  function findStartButtons(roots = getActiveDocuments()) {
    const results = [];
    for (const root of roots) {
      const candidates = [...root.querySelectorAll('button, [role="button"], input[type="button"], a, div, span')];
      for (const btn of candidates) {
        if (btn.disabled || btn.hasAttribute('disabled')) continue;
        const text = (btn.innerText || btn.textContent || btn.value || '').trim();
        if (/^start$/i.test(text) || /^start\s*(test|assessment|quiz)?$/i.test(text)) {
          const clickTarget = btn.closest('button, [role="button"], a') || btn;
          if (!results.includes(clickTarget)) results.push(clickTarget);
        }
      }
    }
    return results;
  }

  function findAttemptSectionButtons(roots = getActiveDocuments()) {
    const results = [];
    for (const root of roots) {
      // Find ANY button, link, div, span with "Attempt Section" / "Resume Section"
      const candidates = [...root.querySelectorAll('button, a, input[type="button"], [role="button"], div, span')];
      for (const el of candidates) {
        if (el.disabled || el.hasAttribute('disabled')) continue;
        const txt = (el.innerText || el.textContent || el.value || '').trim();
        if (
          /^attempt\s*section$/i.test(txt) ||
          /^resume\s*section$/i.test(txt) ||
          /^start\s*section$/i.test(txt) ||
          (/attempt\s*section/i.test(txt) && txt.length < 35)
        ) {
          // Select closest interactive button or element itself
          const target = el.closest('button, [role="button"], a') || el;
          if (!results.includes(target)) {
            const rect = target.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              results.push(target);
            }
          }
        }
      }
    }
    return results;
  }

  function findSaveButton(roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"], div, span')
      ];
      for (const btn of candidates) {
        if (btn.disabled || btn.hasAttribute('disabled')) continue;
        const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
        if (text === 'save' || text === 'save & next' || text === 'save and next' || text === 'next') {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return btn.closest('button, [role="button"], a') || btn;
          }
        }
      }
    }
    return null;
  }

  function findFinishButton(roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll('button, input[type="button"], a, [role="button"], div, span')
      ];
      for (const btn of candidates) {
        if (btn.disabled || btn.hasAttribute('disabled')) continue;
        const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
        if (
          text === 'finish test' ||
          text === 'finish' ||
          text === 'end test' ||
          text === 'submit test' ||
          text === 'submit' ||
          text === 'submit assessment'
        ) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return btn.closest('button, [role="button"], a') || btn;
          }
        }
      }
    }
    return null;
  }

  function findBackButtonToSections(roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll('button, [role="button"], a, i, mat-icon, span, svg, div')
      ];
      for (const el of candidates) {
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const cls  = (el.className?.toString() || '').toLowerCase();
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();

        if (
          aria.includes('back') ||
          aria.includes('section') ||
          cls.includes('back') ||
          cls.includes('arrow-left') ||
          text === 'arrow_back' ||
          text === 'chevron_left' ||
          text === '←' ||
          text === '<'
        ) {
          const target = el.closest('button, a, [role="button"]') || el;
          const rect = target.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left < 200) {
            return target;
          }
        }
      }

      // Check for SECTIONS tab directly
      const tabs = [...root.querySelectorAll('[role="tab"], .mat-tab-label, button, a')];
      for (const t of tabs) {
        if (t.textContent.trim().toLowerCase() === 'sections') {
          return t;
        }
      }
    }
    return null;
  }

  function isElementRendered(el) {
    if (!el) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      // Do not restrict by window.innerHeight: long questions/options scroll down below viewport height
      return rect.right > 0 && rect.left < (window.innerWidth || document.documentElement.clientWidth);
    } catch (_) {
      return false;
    }
  }

  function clickPaletteCircle(qIndex, roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll('.q-num, .circle, .question-number, .palette-item, .palette-circle, button, span, div, a')
      ];
      for (const c of candidates) {
        if (c.children.length <= 1 && c.textContent.trim() === String(qIndex)) {
          const rect = c.getBoundingClientRect();
          // Must be strictly in the left sidebar palette (x < 280, top > 60)
          if (rect.width > 0 && rect.height > 0 && rect.left < 280 && rect.top > 60) {
            log(`Clicking palette circle ${qIndex}`);
            clickElementThoroughly(c);
            return true;
          }
        }
      }
    }
    return false;
  }

  function getCurrentQuestionNumber(roots = getActiveDocuments()) {
    for (const root of roots) {
      // 1. Check active/highlighted circle in palette (sidebar left < 280) - Most reliable in Springboard!
      const activeCircles = [
        ...root.querySelectorAll('.active, .selected, .current, [aria-current="true"], .q-selected, .active-circle, .circle-active')
      ];
      for (const ac of activeCircles) {
        const txt = ac.textContent.trim();
        const m = txt.match(/^(\d{1,3})$/);
        if (m) {
          const rect = ac.getBoundingClientRect();
          if (rect.left < 280 && rect.width > 0 && rect.height > 0) {
            const num = parseInt(m[1], 10);
            if (num >= 1 && num <= 100) return num;
          }
        }
      }

      // 2. Heading or question indicator in main area (left > 150)
      const candidates = [...root.querySelectorAll('.question-title, .question-number, h1, h2, h3, h4, h5, h6, div, span, p')];
      for (const el of candidates) {
        const txt = el.textContent.trim();
        if (txt.length > 0 && txt.length < 60) {
          const match = txt.match(/(?:Question|Q\.?)\s*[:\-\.]?\s*(\d{1,3})/i);
          if (match) {
            const rect = el.getBoundingClientRect();
            if (rect.left > 150 && rect.width > 0 && rect.height > 0) {
              const num = parseInt(match[1], 10);
              if (num >= 1 && num <= 100) return num;
            }
          }
        }
      }
    }
    return null;
  }

  async function waitForQuestionChange(prevQNum, prevSig, maxWaitMs = 2500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await sleep(100);
      const newQNum = getCurrentQuestionNumber();
      if (newQNum !== null && prevQNum !== null && newQNum !== prevQNum) {
        return true;
      }
      const qData = scrapeCurrentQuestion();
      if (qData) {
        const newSig = qData.questionText + '|' + qData.options.map(o => o.text).join(',');
        if (newSig !== prevSig) {
          return true;
        }
      }
    }
    return false;
  }

  function getPaletteCircleCount(roots = getActiveDocuments()) {
    // 1. Look for explicit total questions text e.g. "total 25 questions" or "0 of 25 attempted"
    for (const root of roots) {
      const bodyText = root.body?.innerText || root.body?.textContent || '';
      const m1 = bodyText.match(/total\s+(\d{1,3})\s+questions/i);
      if (m1) {
        const n = parseInt(m1[1], 10);
        if (n > 0 && n <= 100) return n;
      }
      const m2 = bodyText.match(/(\d+)\s+of\s+(\d{1,3})\s+attempted/i);
      if (m2) {
        const n = parseInt(m2[2], 10);
        if (n > 0 && n <= 100) return n;
      }
    }

    // 2. Count consecutive numbered circles strictly inside the left sidebar palette
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll('.q-num, .circle, .question-number, .palette-item, .palette-circle, button, span, div, a')
      ];
      const foundNumbers = new Set();
      for (const c of candidates) {
        if (c.children.length <= 1) {
          const txt = c.textContent.trim();
          if (/^\d{1,3}$/.test(txt)) {
            const rect = c.getBoundingClientRect();
            // Sidebar palette is strictly on the left (x < 280), never in timer at top center/right
            if (rect.width > 0 && rect.height > 0 && rect.left < 280 && rect.top > 60) {
              const n = parseInt(txt, 10);
              if (n >= 1 && n <= 100) {
                foundNumbers.add(n);
              }
            }
          }
        }
      }

      // Find unbroken consecutive sequence starting from 1: 1, 2, 3...
      let count = 0;
      while (foundNumbers.has(count + 1)) {
        count++;
      }
      if (count >= 2) {
        return count;
      }
    }

    return 25; // Default fallback for Springboard assessments
  }

  function clickElementThoroughly(el) {
    if (!el) return;
    const target = el.closest('button, [role="button"], a') || el;
    try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}

    const opts = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent('pointerdown', opts));
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.focus?.();
    target.dispatchEvent(new PointerEvent('pointerup', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.click();

    // Also click inner span/button if present
    const inner = target.querySelector('button, span, a');
    if (inner && inner !== target) {
      inner.click();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION & OPTION SCRAPER (Targeting Strictly Visible Active Question)
  // ═══════════════════════════════════════════════════════════════════════════

  function scrapeCurrentQuestion(roots = getActiveDocuments()) {
    for (const root of roots) {
      let optionContainers = [];
      let isMultipleSelect = false;

      // ── Strategy A: Angular Material mat-radio-button (Single Choice) ──
      const matRadios = [...root.querySelectorAll('mat-radio-button, [role="radio"]')].filter(mr => {
        if (!isElementRendered(mr)) return false;
        const rect = mr.getBoundingClientRect();
        return rect.left > 160; // Must be in main question area, not in sidebar
      });

      // ── Strategy B: Angular Material mat-checkbox (Multiple Choice) ──
      const matCheckboxes = [...root.querySelectorAll('mat-checkbox, [role="checkbox"]')].filter(mc => {
        if (!isElementRendered(mc)) return false;
        const rect = mc.getBoundingClientRect();
        return rect.left > 160;
      });

      if (matRadios.length >= 2) {
        isMultipleSelect = false;
        optionContainers = matRadios.map((mr, idx) => {
          const labelContent = mr.querySelector('.mat-radio-label-content');
          let text = labelContent ? (labelContent.innerText || labelContent.textContent) : (mr.innerText || mr.textContent);
          text = (text || `Option ${idx + 1}`).replace(/\s+/g, ' ').replace(/^[A-Da-d0-9][\.\)\-]\s*/, '').trim();
          const clickTarget = mr.querySelector('label') || mr;
          return {
            element: clickTarget,
            container: mr,
            inputElement: mr.querySelector('input'),
            text,
            isCheckbox: false
          };
        });
      } else if (matCheckboxes.length >= 2) {
        isMultipleSelect = true;
        optionContainers = matCheckboxes.map((mc, idx) => {
          const labelContent = mc.querySelector('.mat-checkbox-label, .mat-checkbox-layout');
          let text = labelContent ? (labelContent.innerText || labelContent.textContent) : (mc.innerText || mc.textContent);
          text = (text || `Option ${idx + 1}`).replace(/\s+/g, ' ').replace(/^[A-Da-d0-9][\.\)\-]\s*/, '').trim();
          const clickTarget = mc.querySelector('label') || mc;
          return {
            element: clickTarget,
            container: mc,
            inputElement: mc.querySelector('input'),
            text,
            isCheckbox: true
          };
        });
      } else {
        // ── Strategy C: Native Checkbox Inputs ──
        const nativeCheckboxes = [...root.querySelectorAll('input[type="checkbox"]')].filter(inp => {
          const target = inp.closest('label, .checkbox, .option') || inp;
          if (!isElementRendered(target)) return false;
          return target.getBoundingClientRect().left > 160;
        });

        // ── Strategy D: Native Radio Inputs ──
        const nativeRadios = [...root.querySelectorAll('input[type="radio"]')].filter(inp => {
          const target = inp.closest('label, .radio, .option') || inp;
          if (!isElementRendered(target)) return false;
          return target.getBoundingClientRect().left > 160;
        });

        if (nativeCheckboxes.length >= 2) {
          isMultipleSelect = true;
          optionContainers = nativeCheckboxes.map((input, idx) => {
            let text = '';
            if (input.id) {
              const lbl = root.querySelector(`label[for="${input.id}"]`);
              if (lbl) text = lbl.innerText || lbl.textContent;
            }
            if (!text) {
              const parentLbl = input.closest('label');
              if (parentLbl) text = parentLbl.innerText || parentLbl.textContent;
            }
            if (!text && input.parentElement) {
              text = input.parentElement.innerText || input.parentElement.textContent;
            }
            text = (text || `Option ${idx + 1}`).replace(/\s+/g, ' ').replace(/^[A-Da-d0-9][\.\)\-]\s*/, '').trim();
            const clickTarget = input.closest('label, mat-checkbox, .checkbox, .option') || input;
            return {
              element: clickTarget,
              container: clickTarget,
              inputElement: input,
              text,
              isCheckbox: true
            };
          });
        } else if (nativeRadios.length >= 2) {
          isMultipleSelect = false;
          optionContainers = nativeRadios.map((input, idx) => {
            let text = '';
            if (input.id) {
              const lbl = root.querySelector(`label[for="${input.id}"]`);
              if (lbl) text = lbl.innerText || lbl.textContent;
            }
            if (!text) {
              const parentLbl = input.closest('label');
              if (parentLbl) text = parentLbl.innerText || parentLbl.textContent;
            }
            if (!text && input.parentElement) {
              text = input.parentElement.innerText || input.parentElement.textContent;
            }
            text = (text || `Option ${idx + 1}`).replace(/\s+/g, ' ').replace(/^[A-Da-d0-9][\.\)\-]\s*/, '').trim();
            const clickTarget = input.closest('label, mat-radio-button, .radio, .option') || input;
            return {
              element: clickTarget,
              container: clickTarget,
              inputElement: input,
              text,
              isCheckbox: false
            };
          });
        } else {
          // ── Strategy E: Custom Styled Choice Wrappers ──
          const customWrappers = [...root.querySelectorAll('.custom-control-label, .mat-radio-label, .radio-label, .option, .choice')].filter(cw => {
            if (!isElementRendered(cw)) return false;
            return cw.getBoundingClientRect().left > 160;
          });

          if (customWrappers.length >= 2 && customWrappers.length <= 8) {
            optionContainers = customWrappers.map((cw, idx) => {
              const text = (cw.innerText || cw.textContent || `Option ${idx + 1}`).replace(/\s+/g, ' ').replace(/^[A-Da-d0-9][\.\)\-]\s*/, '').trim();
              return {
                element: cw,
                container: cw,
                inputElement: cw.querySelector('input'),
                text,
                isCheckbox: false
              };
            });
          }
        }
      }

      if (optionContainers.length < 2) continue;

      // Extract Question Stem & Code Snippets from ACTIVE visible question container
      const firstOpt = optionContainers[0].element;
      const questionCard = firstOpt.closest(
        '.question-container, .question-card, .test-question, form, .question-body, div.col-md-9, div.col-md-10, div.col-sm-9, div.col-xs-12'
      ) || firstOpt.parentElement?.parentElement?.parentElement || root.body;

      // Collect code snippets inside this visible card
      const codeEls = [...questionCard.querySelectorAll('pre, code, xmp, .code-snippet, .code-block, textarea')].filter(isElementRendered);
      let codeSnippet = '';
      if (codeEls.length > 0) {
        codeSnippet = codeEls.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean).join('\n\n');
      }

      let fullText = (questionCard.innerText || questionCard.textContent || '');
      const firstOptText = optionContainers[0].text;
      const optIndex = fullText.indexOf(firstOptText);
      let questionText = '';
      if (optIndex > 5) {
        questionText = fullText.slice(0, optIndex).trim();
      } else {
        questionText = fullText.slice(0, 600).trim();
      }

      // Clean metadata headers, timers, and boilerplate
      questionText = questionText
        .replace(/OBJECTIVE QUESTIONS/gi, '')
        .replace(/Assessment\s*-\s*[^\n]+/gi, '')
        .replace(/\d+\s*:\s*\d+\s*:\s*\d+\s*(Hours|Minutes|Seconds)*/gi, '')
        .replace(/Question\s*\d+/gi, '')
        .trim();

      if (codeSnippet && !questionText.includes(codeSnippet.slice(0, 20))) {
        questionText = `${questionText}\n\nCode snippet:\n${codeSnippet}`;
      }

      if (!isMultipleSelect) {
        isMultipleSelect = !!questionCard.querySelector('input[type="checkbox"], mat-checkbox, [role="checkbox"]');
      }

      return {
        questionText: questionText || 'Question statement',
        options: optionContainers,
        isMultipleSelect,
        rootDocument: root
      };
    }

    return null;
  }

  // Thorough Angular-compatible option selection (supports radio & checkbox)
  function selectOption(opt) {
    if (!opt || !opt.element) return false;
    const target = opt.element;
    const isCheckbox = opt.isCheckbox || !!target.closest('mat-checkbox, [role="checkbox"], .checkbox');
    const container = opt.container || target.closest(isCheckbox ? 'mat-checkbox, [role="checkbox"]' : 'mat-radio-button, [role="radio"]') || target;
    const input = opt.inputElement || (target.tagName === 'INPUT' ? target : container.querySelector('input'));

    try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}

    // 1. Dispatch full pointer/mouse sequence on label/container
    const opts = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent('pointerdown', opts));
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.focus?.();
    target.dispatchEvent(new PointerEvent('pointerup', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.click();

    // 2. Also click inner label or radio/checkbox container
    const innerTarget = container.querySelector('label, .mat-radio-label, .mat-radio-container, .mat-checkbox-layout, .mat-checkbox-inner-container');
    if (innerTarget && innerTarget !== target) {
      innerTarget.click();
    }

    // 3. Directly click and update native input to trigger Angular ControlValueAccessor
    if (input) {
      input.click();
      input.checked = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 4. Set Angular classes for visual and state consistency
    if (container.classList) {
      if (isCheckbox) {
        container.classList.add('mat-checkbox-checked');
      } else {
        container.classList.add('mat-radio-checked');
      }
      container.setAttribute('aria-checked', 'true');
    }

    return true;
  }

  function isAnyOptionChecked(options) {
    for (const opt of options) {
      const container = opt.container || opt.element;
      const input = opt.inputElement || container?.querySelector?.('input');
      if (input && input.checked) return true;
      if (container && (
        container.classList?.contains('mat-radio-checked') ||
        container.classList?.contains('mat-checkbox-checked') ||
        container.getAttribute?.('aria-checked') === 'true'
      )) {
        return true;
      }
    }
    return false;
  }

  function forceCheckOption(opt) {
    if (!opt) return;
    const target = opt.element;
    const isCheckbox = opt.isCheckbox || !!target.closest('mat-checkbox, [role="checkbox"]');
    const container = opt.container || target.closest(isCheckbox ? 'mat-checkbox, [role="checkbox"]' : 'mat-radio-button, [role="radio"]') || target;
    const input = opt.inputElement || (target.tagName === 'INPUT' ? target : container.querySelector('input'));

    if (input) {
      input.checked = true;
      input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const label = container.querySelector('label, .mat-radio-label, .mat-radio-container, .mat-checkbox-layout, .mat-checkbox-inner-container');
    if (label) {
      label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    if (container.classList) {
      if (isCheckbox) {
        container.classList.add('mat-checkbox-checked');
      } else {
        container.classList.add('mat-radio-checked');
      }
      container.setAttribute('aria-checked', 'true');
    }
  }

  function checkToastError(root) {
    try {
      const allText = (root.body?.innerText || '').toLowerCase();
      return allText.includes('please enter your response to save');
    } catch (_) {
      return false;
    }
  }

  async function confirmSubmitDialog(roots = getActiveDocuments()) {
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(350);
      for (const root of roots) {
        const dialogs = [
          ...root.querySelectorAll('mat-dialog-container, [role="dialog"], .modal, .modal-dialog, .cdk-overlay-pane')
        ];

        for (const dialog of dialogs) {
          const rect = dialog.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const btns = [...dialog.querySelectorAll('button, [role="button"], a, input[type="button"]')];
          for (const b of btns) {
            if (b.disabled || b.hasAttribute('disabled')) continue;
            const txt = (b.innerText || b.textContent || b.value || '').trim().toLowerCase();
            if (
              (txt.includes('yes') || txt.includes('confirm') || txt.includes('submit') || txt.includes('finish') || txt.includes('ok')) &&
              !txt.includes('cancel') && !txt.includes('no')
            ) {
              log(`Confirming submit dialog button: "${txt}"`);
              b.click();
              await sleep(2000);
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN MULTI-SECTION ASSESSMENT SOLVER ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  async function startAssessmentSolver() {
    log('🎯 Starting Gemini 3.8 Flash Assessment Solver...');
    isRunning = true;
    isPaused  = false;
    sendStatus({ status: 'running', message: '🎯 Initializing Gemini 3.8 Flash...' });

    const { aiQuizEnabled, geminiApiKey } = await chrome.storage.local.get([
      'aiQuizEnabled',
      'geminiApiKey'
    ]);

    if (aiQuizEnabled === false || !geminiApiKey) {
      const err = 'Gemini API Key missing! Paste your key in extension settings & click Save & Test.';
      sendStatus({ status: 'error', message: err });
      isRunning = false;
      return;
    }

    // ── STEP 1: Handle Instructions Screen (if Start button present) ──
    const startBtns = findStartButtons();
    if (startBtns.length > 0) {
      log(`Clicking Start button: "${startBtns[0].textContent.trim()}"`);
      clickElementThoroughly(startBtns[0]);
      await sleep(2500);
    }

    // ── STEP 2: Multi-Section Attempt Loop ──
    let totalQuestionsAnswered = 0;
    let sectionCount = 0;

    while (isRunning) {
      while (isPaused) { await sleep(400); }

      // Look for available "Attempt Section" / "Resume Section" buttons across all documents
      const sectionButtons = findAttemptSectionButtons();

      if (sectionButtons.length > 0) {
        sectionCount++;
        const currentSectionBtn = sectionButtons[0];
        const sectionCard = currentSectionBtn.closest('.section-card, .section, tr, div') || currentSectionBtn.parentElement;
        const sectionName = (sectionCard?.innerText || sectionCard?.textContent || '').split('\n')[0].slice(0, 35).trim() || `Section ${sectionCount}`;

        log(`▶ Entering Section: ${sectionName}...`);
        sendStatus({ status: 'running', message: `Entering ${sectionName}...` });

        clickElementThoroughly(currentSectionBtn);
        await sleep(2500);

        // Solve all questions inside this section
        const answeredInSection = await solveCurrentSectionQuestions(sectionName);
        totalQuestionsAnswered += answeredInSection;

        // Return back to Sections screen via Back Arrow
        log('Section completed. Navigating back to Sections screen...');
        const backBtn = findBackButtonToSections();
        if (backBtn) {
          clickElementThoroughly(backBtn);
          await sleep(2000);
        } else {
          await sleep(1500);
        }

        // Loop again to see if next section exists
        continue;
      }

      // If directly on a question screen without section buttons (e.g. single-section assessment or in-course quiz):
      const qData = scrapeCurrentQuestion();
      if (qData) {
        log('Direct question screen detected. Solving questions directly...');
        const answered = await solveCurrentSectionQuestions('Assessment');
        totalQuestionsAnswered += answered;
      }

      // No more sections to attempt!
      break;
    }

    // ── STEP 3: Finish & Submit Test ──
    log('All sections attempted! Looking for Finish test button...');
    sendStatus({ status: 'running', message: 'Submitting completed assessment...' });
    await sleep(1500);

    const finishBtn = findFinishButton();
    if (finishBtn) {
      log(`Clicking Finish button: "${finishBtn.textContent.trim()}"`);
      clickElementThoroughly(finishBtn);
      await sleep(1500);
      await confirmSubmitDialog();
    }

    isRunning = false;
    const finalMsg = `🎉 Assessment complete! Solved ${totalQuestionsAnswered} questions across ${sectionCount || 1} section(s).`;
    log(finalMsg);
    sendStatus({
      status: 'done',
      message: finalMsg,
      completed: totalQuestionsAnswered,
      total: totalQuestionsAnswered,
      quizzes: 1
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION QUESTION SOLVER
  // ═══════════════════════════════════════════════════════════════════════════

  async function solveCurrentSectionQuestions(sectionName = 'Section') {
    // Detect question count in this section
    let totalQuestions = getPaletteCircleCount();
    if (!totalQuestions) {
      const allDocs = getActiveDocuments();
      for (const d of allDocs) {
        const matchTotal = (d.body?.textContent || '').match(/(\d+)\s+of\s+(\d+)\s+attempted/i);
        if (matchTotal) {
          totalQuestions = parseInt(matchTotal[2], 10);
          break;
        }
      }
      if (!totalQuestions) totalQuestions = 25;
    }
    log(`[${sectionName}] Total questions to solve: ${totalQuestions}`);

    const answeredSet = new Set();
    let consecutiveNoQuestion = 0;
    let lastHandledSig = '';

    while (isRunning) {
      while (isPaused) { await sleep(300); }

      const domQNum = getCurrentQuestionNumber();
      const qData = scrapeCurrentQuestion();

      if (!qData || !qData.options || qData.options.length < 2) {
        consecutiveNoQuestion++;
        const nextTarget = domQNum || (answeredSet.size + 1);

        if (answeredSet.size >= totalQuestions) {
          log(`[${sectionName}] All ${totalQuestions} questions answered!`);
          break;
        }

        if (consecutiveNoQuestion % 4 === 0) {
          log(`[${sectionName}] Waiting for question options (attempt ${consecutiveNoQuestion}). Target: Q${nextTarget}`);
          clickPaletteCircle(nextTarget);
        }

        if (consecutiveNoQuestion > 20) {
          log(`[${sectionName}] Timeout waiting for question ${nextTarget}. Moving on.`);
          break;
        }

        await sleep(400);
        continue;
      }

      consecutiveNoQuestion = 0;

      // Real Question Number & Signature
      const effectiveQNum = domQNum || (answeredSet.size + 1);
      const qSig = `${effectiveQNum}|${qData.questionText}|${qData.options.map(o => o.text).join(',')}`;

      // Avoid re-solving if we are still on the exact same question that was already answered in this section
      if (qSig === lastHandledSig && answeredSet.has(effectiveQNum)) {
        log(`Question ${effectiveQNum} already answered. Advancing to next question...`);
        const nextQ = effectiveQNum + 1;
        if (nextQ <= totalQuestions) {
          clickPaletteCircle(nextQ);
          await sleep(600);
          continue;
        } else {
          break;
        }
      }

      log(`[${effectiveQNum}/${totalQuestions}] Asking Gemini AI: "${qData.questionText.slice(0, 45)}..." (Type: ${qData.isMultipleSelect ? 'Multiple' : 'Single'})`);
      sendStatus({
        status: 'running',
        message: `[${effectiveQNum}/${totalQuestions}] Gemini: ${qData.questionText.slice(0, 34)}...`,
        completed: answeredSet.size,
        total: totalQuestions,
        quizzes: 1
      });

      // ── Call Gemini AI ──
      const startTime = performance.now();
      const geminiRes = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'SOLVE_QUIZ_QUESTION',
          question: qData.questionText,
          options: qData.options.map(o => o.text),
          isMultipleSelect: qData.isMultipleSelect
        }, resolve);
      });
      const latencyMs = Math.round(performance.now() - startTime);

      let selectedIndices = [0];
      let selectedText = '';
      if (geminiRes?.success && Array.isArray(geminiRes.selected_indices) && geminiRes.selected_indices.length > 0) {
        log(`Gemini selected: [${geminiRes.selected_indices.join(', ')}] (${geminiRes.explanation || ''})`);
        selectedIndices = geminiRes.selected_indices;
        for (const idx of selectedIndices) {
          const opt = qData.options[idx];
          if (opt) {
            selectOption(opt);
            await sleep(80);
          }
        }
        selectedText = selectedIndices.map(i => qData.options[i]?.text || `[${i}]`).join('; ');
      } else {
        log(`Gemini fallback (${geminiRes?.error || 'no indices'}). Selecting option 0.`);
        selectedIndices = [0];
        selectedText = qData.options[0]?.text || '';
        if (qData.options[0]) {
          selectOption(qData.options[0]);
          await sleep(80);
        }
      }

      // Stream communication into the Live Inspector
      appendAiCommunicationLog({
        questionNumber: effectiveQNum,
        totalQuestions: totalQuestions,
        questionText: qData.questionText,
        options: qData.options.map(o => o.text),
        isMultipleSelect: qData.isMultipleSelect,
        selectedIndices,
        selectedText,
        explanation: geminiRes?.explanation || (geminiRes?.error ? `Fallback reason: ${geminiRes.error}` : ''),
        model: geminiRes?.model || 'gemini-2.0-flash',
        latencyMs,
        timestamp: new Date().toLocaleTimeString(),
        status: geminiRes?.success ? 'success' : 'fallback'
      });

      // Verify at least one option is marked checked before saving
      if (!isAnyOptionChecked(qData.options)) {
        log('⚠️ Selection check verification failed. Force checking chosen option...');
        if (qData.options[selectedIndices[0]]) {
          forceCheckOption(qData.options[selectedIndices[0]]);
          await sleep(100);
        }
      }

      answeredSet.add(effectiveQNum);
      lastHandledSig = qSig;

      // ── Save Answer ──
      const saveBtn = findSaveButton([qData.rootDocument]);
      if (saveBtn) {
        log(`Saving answer for question ${effectiveQNum}...`);
        clickElementThoroughly(saveBtn);
        await sleep(350);

        if (checkToastError(qData.rootDocument)) {
          log('⚠️ Toast detected: "Please enter your response to save"! Force checking and re-saving...');
          if (qData.options[selectedIndices[0]]) {
            forceCheckOption(qData.options[selectedIndices[0]]);
            await sleep(150);
            clickElementThoroughly(saveBtn);
            await sleep(350);
          }
        }
      }

      // If all questions answered or on last question, finish section
      if (answeredSet.size >= totalQuestions || effectiveQNum >= totalQuestions) {
        log(`[${sectionName}] Successfully completed all ${totalQuestions} questions!`);
        await sleep(1000);
        break;
      }

      // Wait cleanly for question transition
      const changed = await waitForQuestionChange(effectiveQNum, qSig, 2500);
      if (!changed) {
        // If clicking Save didn't advance, advance manually via circle
        const nextQ = effectiveQNum + 1;
        log(`Save did not auto-transition. Clicking palette circle for Question ${nextQ}...`);
        clickPaletteCircle(nextQ);
        await sleep(600);
      }
    }

    return answeredSet.size;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE & EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
      case 'START':
      case 'START_ASSESSMENT_SOLVER':
        if (!isRunning) {
          startAssessmentSolver();
        }
        sendResponse({ ok: true });
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
        const existingHud = document.getElementById('springbored-assignment-hud');
        if (existingHud) existingHud.remove();
        sendResponse({ ok: true });
        break;
      case 'GET_STATUS':
        sendResponse({ isRunning, isPaused, hasAssessment: hasAssessmentDom() });
        break;
      default:
        break;
    }
    return true;
  });

  // Cross-frame coordination via postMessage
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SPB_START_SOLVER') {
      if (hasAssessmentDom() && !isRunning) {
        log('Received SPB_START_SOLVER across frames — launching solver!');
        startAssessmentSolver();
      }
    }
  });

  log('Assignment solver content script ready');
})();
