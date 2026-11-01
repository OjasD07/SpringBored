// SpringBored (Assessment Edition) - Content Script v1.0.0
// Autonomous Quiz, Test, and Multi-Section Assessment (IAP) Solver
// Powered by Google Gemini AI.

(function () {
  "use strict";

  if (window.__SPRINGBORED_ASSIGNMENT_LOADED__) return;
  window.__SPRINGBORED_ASSIGNMENT_LOADED__ = true;

  // ─── State ────────────────────────────────────────────────────────────────
  let isRunning = false;
  let isPaused = false;
  let solverAbortedForFailure = false;
  let lastAbortErrorMessage = "";
  let lastContentWorkingModel = null;
  let activeAnsweringModel = null;

  function recordActiveAnsweringModel(modelName) {
    if (!modelName) return;
    const clean = String(modelName).replace(/^models\//, "").trim();
    if (!clean) return;
    activeAnsweringModel = clean;
    lastContentWorkingModel = clean;
    const modelEl = document.getElementById("sbHudModel");
    if (modelEl) {
      modelEl.textContent = formatModelName(clean);
    }
    try {
      chrome.storage.local.set({ geminiModel: clean });
    } catch (_) {}
  }

  // ─── Logging & Utilities ──────────────────────────────────────────────────
  const log = (msg) =>
    console.log(
      `%c[SpringBored Assessment] ${msg}`,
      "color:#38bdf8;font-weight:bold",
    );

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function sanitizeApiKeyInContent(input) {
    if (!input || typeof input !== "string") return "";
    let cleaned = input.replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060\uFEFF]/g,
      "",
    );
    const aizaMatch = cleaned.match(/AIza[A-Za-z0-9_-]{20,}/);
    if (aizaMatch) return aizaMatch[0];
    cleaned = cleaned
      .trim()
      .replace(/^(?:export\s+)?[A-Za-z0-9_]*(?:KEY|TOKEN)[A-Za-z0-9_]*\s*[:=]\s*/i, "")
      .trim()
      .replace(/^['"`]+|['"`]+$/g, "")
      .replace(/\s+/g, "");
    const wrappedMatch = cleaned.match(/AIza[A-Za-z0-9_-]{20,}/);
    if (wrappedMatch) return wrappedMatch[0];
    return cleaned;
  }

  function parseJsonSafeInContent(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {}
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence && fence[1]) {
      try {
        return JSON.parse(fence[1].trim());
      } catch (_) {}
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_) {}
    }
    return null;
  }

  function matchOptionTextInContent(candidateText, options) {
    if (!candidateText || typeof candidateText !== "string" || !Array.isArray(options)) {
      return null;
    }
    const normalize = (s) =>
      String(s || "")
        .replace(/^Index\s+\d+\s*(?:\(Option\s+[A-Z]\))?\s*[:\-]?\s*/i, "")
        .replace(/^(?:Option\s+)?\(?[A-Za-z0-9]\)?[\.\)\:\-]\s*/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const target = normalize(candidateText);
    if (!target) return null;

    const exact = [];
    for (let i = 0; i < options.length; i++) {
      if (normalize(options[i]) === target) exact.push(i);
    }
    if (exact.length === 1) return exact[0];

    if (target.length >= 4) {
      const sub = [];
      for (let i = 0; i < options.length; i++) {
        const optNorm = normalize(options[i]);
        if (!optNorm) continue;
        if (optNorm.includes(target) || (optNorm.length >= 12 && target.includes(optNorm))) {
          sub.push(i);
        }
      }
      if (sub.length === 1) return sub[0];
    }
    return null;
  }

  function convertChoiceToIndexInContent(val, options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    if (typeof val === "number" && !isNaN(val)) {
      return val >= 0 && val < options.length ? val : null;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        return num >= 0 && num < options.length ? num : null;
      }
      const idxMatch = trimmed.match(/^Index\s+(\d+)\b/i);
      if (idxMatch) {
        const num = parseInt(idxMatch[1], 10);
        return num >= 0 && num < options.length ? num : null;
      }
      const hasSingleCharOption = options.some((o) => String(o || "").trim().length === 1);
      if (hasSingleCharOption) {
        const exactIdx = options.findIndex(
          (o) => String(o || "").trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (exactIdx !== -1) return exactIdx;
      }
      const letterMatch = trimmed.match(/^(?:option\s*)?\(?([A-Ha-h])\)?[\.\:\s]*$/i);
      if (letterMatch) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        return idx >= 0 && idx < options.length ? idx : null;
      }
      const textIdx = matchOptionTextInContent(trimmed, options);
      if (textIdx !== null) return textIdx;
    }
    return null;
  }

  /**
   * Direct content-script fallback solver against Google's Gemini API.
   * Ensures questions are solved even if the background service worker was not
   * reloaded or hit a model rate-limit.
   */
  async function solveQuestionDirectlyInContent(
    questionText,
    options,
    isMultipleSelect,
    assessmentContext = "",
    images = [],
  ) {
    try {
      const { geminiApiKey, geminiModel, geminiApiVersion } =
        await chrome.storage.local.get(["geminiApiKey", "geminiModel", "geminiApiVersion"]);
      const cleanKey = sanitizeApiKeyInContent(geminiApiKey);
      if (!cleanKey) {
        return { success: false, error: "Gemini API key missing in storage" };
      }

      const safeOptions = (options || []).map((o) => String(o || "").trim());
      const optionsFormatted = safeOptions
        .map((opt, idx) => `Index ${idx} (Option ${String.fromCharCode(65 + idx)}): ${opt}`)
        .join("\n\n");

      const contextSection = assessmentContext
        ? `\n=== ASSESSMENT / SUBJECT DOMAIN ===\n${String(assessmentContext).slice(0, 600)}\n(Interpret all terminology, programming language bindings, library APIs, and conventions strictly within this subject domain.)\n=== END SUBJECT DOMAIN ===\n`
        : "";

      const prompt = `You are a principal subject-matter expert and examination solver with mastery across Computer Science, Software Engineering, Data Structures & Algorithms, Databases/SQL, Selenium/Automation, Cloud, Networking, Mathematics, Statistics, Science, Finance, Management, and all academic and professional disciplines.

Read the ENTIRE question stem (including any code listings, tables, formulas, or numbered statements) and EVERY option below carefully before determining the answer.
${contextSection}
=== COMPLETE QUESTION (${safeOptions.length} OPTIONS) ===
${questionText}
=== END QUESTION ===

=== ALL OPTIONS (0-BASED INDICES 0 TO ${safeOptions.length - 1}) ===
${optionsFormatted}
=== END OPTIONS ===

QUESTION TYPE:
${isMultipleSelect ? "MULTIPLE-SELECT (CHECKBOXES): Select ALL options that are objectively true/correct." : "SINGLE-SELECT (RADIO BUTTONS): Select EXACTLY ONE option that is objectively the best/correct answer."}

MANDATORY SOLVING PROTOCOL:
1. Check the exact polarity of the question first (whether it asks for what IS true/correct or what is NOT/EXCEPT/FALSE/INVALID).
2. Analyze the full question stem. If code, SQL, XPath, pseudocode, or math expressions are present, trace the exact syntax and execution rules line-by-line.
3. Evaluate EVERY option from Index 0 (Option A) through Index ${safeOptions.length - 1} (Option ${String.fromCharCode(64 + safeOptions.length)}) individually in "option_analysis".
4. Verify that your chosen 0-based index in "selected_indices" matches the exact option text you place in "selected_option_texts" (Option A = 0, Option B = 1, Option C = 2, Option D = 3).
5. Respond ONLY with a valid JSON object matching this exact schema:
{
  "question_polarity": "POSITIVE or NEGATIVE",
  "option_analysis": [
    "Index 0 (Option A): [True/False] reason",
    "Index 1 (Option B): [True/False] reason"
  ],
  "reasoning": "Step-by-step verification of the correct answer",
  "selected_indices": [0],
  "selected_option_texts": ["Exact text of the selected option"],
  "confidence": "high",
  "explanation": "Clear, concise summary of why this option is correct"
}`;

      const contentParts = [{ text: prompt }];
      if (Array.isArray(images)) {
        for (const img of images.slice(0, 2)) {
          if (img && img.mimeType && img.data) {
            contentParts.push({
              inlineData: {
                mimeType: img.mimeType,
                data: img.data,
              },
            });
          }
        }
      }

      const retired = new Set([
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
      ]);
      const rawModel = (geminiModel || "").replace(/^models\//, "").trim();
      const userModel =
        rawModel && !retired.has(rawModel.toLowerCase()) ? rawModel : "gemini-2.5-flash";

      const fallbackChain = [
        lastContentWorkingModel,
        userModel,
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gemini-2.5-pro",
        "gemini-3.1-pro-preview",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-flash-latest",
        "gemini-pro-latest",
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      const apiVer = geminiApiVersion || "v1beta";
      let lastError = "No model succeeded";
      let discoveredDynamic = false;

      function makeGenConfig(modelName, useJson = true, useThinking = true) {
        const lower = String(modelName || "").toLowerCase();
        const cfg = { temperature: 0.0 };
        if (useJson) cfg.responseMimeType = "application/json";
        if (
          useThinking &&
          (lower === "gemini-2.5-flash" || lower === "gemini-2.5-pro")
        ) {
          cfg.thinkingConfig = {
            thinkingBudget: lower.includes("pro") ? 4096 : 2048,
          };
        }
        return cfg;
      }

      for (let i = 0; i < fallbackChain.length; i++) {
        const model = fallbackChain[i];
        try {
          const baseUrl = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent`;
          let res = await fetch(baseUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": cleanKey,
            },
            body: JSON.stringify({
              contents: [{ parts: contentParts }],
              generationConfig: makeGenConfig(model, true, true),
            }),
          });

          if (!res.ok && res.status === 400) {
            res = await fetch(baseUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": cleanKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: makeGenConfig(model, true, false),
              }),
            });
          }

          if (!res.ok && res.status === 400) {
            res = await fetch(baseUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": cleanKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.0 },
              }),
            });
          }

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const rawMsg = errData?.error?.message || `HTTP ${res.status}`;
            lastError =
              res.status === 429
                ? `Quota/rate limit on ${model} (HTTP 429)`
                : rawMsg;

            if (rawMsg.toLowerCase().includes("api key not valid")) {
              return { success: false, error: "API key not valid. Re-save key in popup." };
            }

            if (!discoveredDynamic && i >= 1) {
              discoveredDynamic = true;
              try {
                const mRes = await fetch(
                  `https://generativelanguage.googleapis.com/${apiVer}/models`,
                  { headers: { "x-goog-api-key": cleanKey } },
                );
                if (mRes.ok) {
                  const mData = await mRes.json().catch(() => ({}));
                  const dynModels = (mData?.models || [])
                    .filter((m) =>
                      (m.supportedGenerationMethods || []).includes("generateContent"),
                    )
                    .map((m) => (m.name || "").replace(/^models\//, ""))
                    .filter(
                      (n) =>
                        n.toLowerCase().includes("gemini") &&
                        !n.toLowerCase().includes("embedding") &&
                        !n.toLowerCase().includes("imagen") &&
                        !n.toLowerCase().includes("tts"),
                    );
                  for (const dm of dynModels) {
                    if (!fallbackChain.includes(dm)) fallbackChain.push(dm);
                  }
                }
              } catch (_) {}
            }
            continue;
          }

          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const textPart =
            parts.filter((p) => !p.thought && typeof p.text === "string").pop() ||
            parts.find((p) => typeof p.text === "string");
          const rawText = textPart?.text;
          if (!rawText) continue;

          const parsed = parseJsonSafeInContent(rawText);
          let rawCandidates = [];
          if (parsed) {
            if (Array.isArray(parsed.selected_indices)) {
              rawCandidates = parsed.selected_indices;
            } else if (
              typeof parsed.selected_indices === "number" ||
              typeof parsed.selected_indices === "string"
            ) {
              rawCandidates = [parsed.selected_indices];
            } else if (parsed.selected_index !== undefined) {
              rawCandidates = [parsed.selected_index];
            } else if (parsed.answer !== undefined) {
              rawCandidates = Array.isArray(parsed.answer)
                ? parsed.answer
                : [parsed.answer];
            }
          }

          const indexCandidates = rawCandidates
            .map((c) => convertChoiceToIndexInContent(c, safeOptions))
            .filter((x) => x !== null && x >= 0 && x < safeOptions.length);

          let textMatched = [];
          if (parsed && parsed.selected_option_texts) {
            const textList = Array.isArray(parsed.selected_option_texts)
              ? parsed.selected_option_texts
              : [parsed.selected_option_texts];
            textMatched = textList
              .map((t) => matchOptionTextInContent(String(t || ""), safeOptions))
              .filter((x) => x !== null && x >= 0 && x < safeOptions.length);
          }

          const indexDisagreed =
            textMatched.length > 0 &&
            indexCandidates.length > 0 &&
            textMatched[0] !== indexCandidates[0];

          let validIndices =
            textMatched.length > 0
              ? [...new Set(textMatched)]
              : [...new Set(indexCandidates)];

          if (validIndices.length === 0) {
            const idxMatches = [
              ...rawText.matchAll(/(?:option|index|choice)\s*[:=\[]?\s*(\d+)/gi),
            ];
            for (const m of idxMatches) {
              const num = parseInt(m[1], 10);
              if (num >= 0 && num < safeOptions.length && !validIndices.includes(num)) {
                validIndices.push(num);
              }
            }
          }

          validIndices = [...new Set(validIndices)];
          if (validIndices.length > 0) {
            let finalIndices = isMultipleSelect ? validIndices : [validIndices[0]];
            let finalExplanation =
              parsed?.explanation ||
              parsed?.reasoning ||
              "Answer reasoned by Gemini AI";
            const confidence = String(parsed?.confidence || "high").toLowerCase();
            const hasNegationOrCode =
              /\b(not|except|false|incorrect|invalid|never|cannot)\b/i.test(questionText) ||
              questionText.includes("```");

            if (
              isMultipleSelect ||
              confidence === "low" ||
              confidence === "medium" ||
              indexDisagreed ||
              hasNegationOrCode
            ) {
              try {
                const proposedSummary = finalIndices
                  .map(
                    (idx) =>
                      `Index ${idx} (Option ${String.fromCharCode(65 + idx)}): ${safeOptions[idx]}`,
                  )
                  .join("; ");
                const criticPrompt = `You are a strict technical exam reviewer verifying a proposed solution before final submission.
${contextSection}
=== QUESTION ===
${questionText}
=== OPTIONS ===
${optionsFormatted}

QUESTION TYPE: ${isMultipleSelect ? "MULTIPLE-SELECT (select all correct options)" : "SINGLE-SELECT (select exactly one option)"}
PROPOSED ANSWER: ${proposedSummary}
PROPOSED REASONING: ${parsed?.reasoning || finalExplanation}

VERIFICATION CHECKLIST:
1. Did the proposed answer misread a negative word (NOT, EXCEPT, FALSE, INVALID)?
2. If there is code, SQL, XPath, or math, trace it again carefully: does another option actually match the exact output/syntax?
3. Are the 0-based index numbers in "selected_indices" 100% aligned with the exact text in "selected_option_texts"?

Respond ONLY with valid JSON:
{
  "verification_notes": "Audit of proposed answer vs alternatives",
  "selected_indices": ${JSON.stringify(finalIndices)},
  "selected_option_texts": ${JSON.stringify(finalIndices.map((idx) => safeOptions[idx]))},
  "explanation": "Final verified explanation"
}`;
                const criticRes = await fetch(baseUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": cleanKey,
                  },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: criticPrompt }] }],
                    generationConfig: makeGenConfig(model, true, true),
                  }),
                });
                if (criticRes.ok) {
                  const criticData = await criticRes.json().catch(() => ({}));
                  const cParts = criticData?.candidates?.[0]?.content?.parts || [];
                  const cTextPart =
                    cParts.filter((p) => !p.thought && typeof p.text === "string").pop() ||
                    cParts.find((p) => typeof p.text === "string");
                  const cParsed = parseJsonSafeInContent(cTextPart?.text || "");
                  if (cParsed) {
                    const cTextList = Array.isArray(cParsed.selected_option_texts)
                      ? cParsed.selected_option_texts
                      : cParsed.selected_option_texts
                        ? [cParsed.selected_option_texts]
                        : [];
                    const cMatched = cTextList
                      .map((t) => matchOptionTextInContent(String(t || ""), safeOptions))
                      .filter((x) => x !== null && x >= 0 && x < safeOptions.length);
                    const cIdxRaw = Array.isArray(cParsed.selected_indices)
                      ? cParsed.selected_indices
                      : cParsed.selected_indices !== undefined
                        ? [cParsed.selected_indices]
                        : [];
                    const cIdx = cIdxRaw
                      .map((c) => convertChoiceToIndexInContent(c, safeOptions))
                      .filter((x) => x !== null && x >= 0 && x < safeOptions.length);
                    const verifiedList =
                      cMatched.length > 0 ? [...new Set(cMatched)] : [...new Set(cIdx)];
                    if (verifiedList.length > 0) {
                      finalIndices = isMultipleSelect ? verifiedList : [verifiedList[0]];
                      finalExplanation =
                        cParsed.explanation ||
                        cParsed.verification_notes ||
                        finalExplanation;
                    }
                  }
                }
              } catch (_) {}
            }

            lastContentWorkingModel = model;
            return {
              success: true,
              selected_indices: finalIndices,
              explanation: finalExplanation,
              model,
            };
          }
        } catch (err) {
          lastError = err.message || "Network error";
        }
      }

      return { success: false, error: lastError };
    } catch (e) {
      return { success: false, error: e.message || "Direct solver failed" };
    }
  }

  /** Ask the service worker for an answer, with automatic direct-API fallback. */
  async function requestGeminiAnswer(payload, timeoutMs = 45000) {
    const bgRes = await new Promise((resolve) => {
      let settled = false;
      let timer = null;

      const finish = (response) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(response ?? null);
      };

      timer = setTimeout(() => finish(null), timeoutMs);

      try {
        chrome.runtime.sendMessage(
          { type: "SOLVE_QUIZ_QUESTION", ...payload },
          (response) => {
            void chrome.runtime.lastError;
            finish(response);
          },
        );
      } catch (_) {
        finish(null);
      }
    });

    if (
      bgRes?.success &&
      Array.isArray(bgRes.selected_indices) &&
      bgRes.selected_indices.length > 0
    ) {
      if (bgRes.model) recordActiveAnsweringModel(bgRes.model);
      return bgRes;
    }

    // Fallback to direct API call from content script if background worker is
    // stale, asleep, or failed on a model rate-limit.
    const directRes = await solveQuestionDirectlyInContent(
      payload.question,
      payload.options,
      payload.isMultipleSelect,
      payload.assessmentContext,
      payload.images,
    );
    if (directRes?.success) {
      if (directRes.model) recordActiveAnsweringModel(directRes.model);
      return directRes;
    }

    return directRes || bgRes || {
      success: false,
      error: "No response from Gemini API",
    };
  }

  // ─── Multi-Frame Document Crawler ─────────────────────────────────────────
  /** Retrieves document and all accessible child iframes in the window tree */
  function getActiveDocuments() {
    const docs = [document];
    try {
      const iframes = [...document.querySelectorAll("iframe")];
      for (const f of iframes) {
        try {
          if (f.contentDocument && !docs.includes(f.contentDocument)) {
            docs.push(f.contentDocument);
            try {
              const nested = [...f.contentDocument.querySelectorAll("iframe")];
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
  function isSameOriginChildFrame() {
    if (window === window.top) return false;
    try {
      return Boolean(window.top && window.top.__SPRINGBORED_ASSIGNMENT_LOADED__);
    } catch (_) {
      return false;
    }
  }

  function hasAssessmentDom() {
    const docs = getActiveDocuments();
    for (const d of docs) {
      if (!d?.body) continue;
      if (findAttemptSectionButtons([d]).length > 0) return true;
      if (findStartButtons([d]).length > 0) return true;
      if (findSaveButton([d])) return true;
      if (findFinishButton([d])) return true;
      if (getAvailablePaletteCircles([d]).length >= 2) return true;
      if (
        d.querySelectorAll(
          'input[type="radio"], [role="radio"], mat-radio-button, .mat-mdc-radio-button, mat-checkbox, .mat-mdc-checkbox',
        ).length >= 2
      ) {
        return true;
      }

      const txt = (d.body.textContent || "").toLowerCase();
      if (
        txt.includes("objective questions") ||
        txt.includes("attempt section") ||
        txt.includes("0 of 25 attempted") ||
        txt.includes("finish test") ||
        txt.includes("expand/collapse all sections") ||
        txt.includes("total duration of the test")
      ) {
        return true;
      }
    }
    return false;
  }

  // ─── Status Communication ─────────────────────────────────────────────────
  // Keep the last progress numbers so pause/resume/stop messages do not make
  // the popup hide its progress panel.
  let lastProgress = { completed: 0, total: 0 };

  function emitTelemetry(event, metrics = {}) {
    chrome.runtime
      .sendMessage({ type: "TELEMETRY_EVENT", event, metrics })
      .catch(() => {});
  }

  function sendStatus(data) {
    if (Number.isFinite(data.total) && data.total > 0) {
      lastProgress = {
        completed: Number.isFinite(data.completed) ? data.completed : 0,
        total: data.total,
      };
    }

    const payload = { ...data };
    if (activeAnsweringModel && !payload.model) {
      payload.model = activeAnsweringModel;
    }
    if (payload.total === undefined && lastProgress.total > 0) {
      payload.completed = Number.isFinite(payload.completed)
        ? payload.completed
        : lastProgress.completed;
      payload.total = lastProgress.total;
    }

    chrome.runtime
      .sendMessage({ type: "STATUS_UPDATE", ...payload })
      .catch(() => {});
    if (
      payload.message &&
      (isRunning || document.getElementById("springbored-assignment-hud"))
    ) {
      const prog =
        payload.completed !== undefined && payload.total
          ? `[${payload.completed}/${payload.total}]`
          : "";
      createOrUpdateHud(payload.message, prog, payload.status === "running");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOATING DRAGGABLE HUD (Bottom-Right by default, never hides Finish button)
  // ═══════════════════════════════════════════════════════════════════════════

  let currentCorner = "bottom-right";
  let isEnlarged = false;
  let autoScrollLogs = true;
  let hudShortcutsBound = false;
  let nextLogId = 1;
  const aiCommunicationLogs = [];
  let lastApiCallTime = 0;
  const MIN_API_INTERVAL_MS = 500;

  function formatModelName(modelCode) {
    if (!modelCode) return "Gemini AI";
    const clean = String(modelCode)
      .replace(/^models\//, "")
      .trim();
    if (clean === "gemini-3.1-pro-preview") return "Gemini 3.1 Pro";
    if (clean === "gemini-3-pro-preview") return "Gemini 3 Pro";
    if (clean === "gemini-3-flash-preview") return "Gemini 3 Flash";
    if (clean === "gemini-2.5-pro") return "Gemini 2.5 Pro";
    if (clean === "gemini-2.5-flash") return "Gemini 2.5 Flash";
    if (clean === "gemini-2.5-flash-lite") return "Gemini 2.5 Flash Lite";
    if (clean === "gemini-2.0-flash") return "Gemini 2.0 Flash";
    if (clean === "gemini-2.0-flash-lite") return "Gemini 2.0 Flash Lite";
    if (clean === "gemini-pro-latest") return "Gemini Pro Latest";
    if (clean === "gemini-flash-latest") return "Gemini Flash Latest";
    return clean
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderLogCard(feed, entry) {
    if (!feed || !entry) return;
    const card = document.createElement("div");
    const qNum = entry.questionNumber || "?";
    const cardId = `sb-hud-card-${entry.logId || qNum}`;
    card.id = cardId;
    card.className = `sb-hud-card ${entry.status === "success" ? "success" : "fallback"}`;

    const optsHtml = (entry.options || [])
      .map((opt, idx) => {
        const isChosen = (entry.selectedIndices || []).includes(idx);
        return `
        <div class="sb-hud-stream-opt ${isChosen ? "chosen" : ""}">
          <span class="sb-hud-stream-idx">[${idx}]</span>
          <span class="sb-hud-stream-txt">${escapeHtml(opt)}</span>
          ${isChosen ? '<span class="sb-hud-stream-check">✓ SELECTED</span>' : ""}
        </div>
      `;
      })
      .join("");

    card.innerHTML = `
      <div class="sb-hud-card-top">
        <div class="sb-hud-card-qinfo">
          <span class="sb-hud-card-qbadge">Question #${escapeHtml(qNum)}</span>
          <span class="sb-hud-card-time">${escapeHtml(entry.timestamp || "")}</span>
        </div>
        <div class="sb-hud-card-perf">
          <span class="sb-hud-card-latency">${escapeHtml(entry.latencyMs || 0)} ms</span>
          <span class="sb-hud-card-model">${escapeHtml(formatModelName(entry.model || "Gemini"))}</span>
        </div>
      </div>

      <div class="sb-hud-card-prompt">
        <div class="sb-hud-sublabel">PROMPT SENT TO GEMINI:</div>
        <div class="sb-hud-prompt-text">${escapeHtml(entry.questionText || "")}</div>
      </div>

      <div class="sb-hud-card-options">
        ${optsHtml}
      </div>

      <div class="sb-hud-card-reply">
        <div class="sb-hud-sublabel">GEMINI AI RESPONSE:</div>
        <div class="sb-hud-ans-highlight">
          Selected Option: <strong>${escapeHtml(entry.selectedText || `[${(entry.selectedIndices || [0]).join(", ")}]`)}</strong>
        </div>
        ${entry.explanation ? `<div class="sb-hud-exp-text">${escapeHtml(entry.explanation)}</div>` : ""}
      </div>
    `;

    feed.appendChild(card);
  }

  function updatePillsBar() {
    const pillsBar = document.getElementById("sbHudPillsBar");
    if (!pillsBar) return;
    pillsBar.innerHTML = "";
    aiCommunicationLogs.forEach((entry) => {
      const qNum = entry.questionNumber;
      if (!qNum) return;
      const pill = document.createElement("button");
      pill.className = "sb-hud-q-pill";
      pill.textContent = `Q${qNum}`;
      pill.title = `Jump to Question ${qNum}`;
      pill.dataset.target = `sb-hud-card-${entry.logId || qNum}`;
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = document.getElementById(pill.dataset.target);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
          [...pillsBar.querySelectorAll(".sb-hud-q-pill")].forEach((p) =>
            p.classList.remove("active"),
          );
          pill.classList.add("active");
        }
      });
      pillsBar.appendChild(pill);
    });
  }

  function appendAiCommunicationLog(entry) {
    entry.logId = nextLogId++;
    aiCommunicationLogs.push(entry);
    if (aiCommunicationLogs.length > 50) aiCommunicationLogs.shift();

    const badge = document.getElementById("sbHudStreamBadge");
    if (badge) badge.textContent = String(aiCommunicationLogs.length);

    const feed = document.getElementById("sbHudStreamFeed");
    const placeholder = document.getElementById("sbHudPlaceholder");
    if (placeholder) placeholder.style.display = "none";

    if (feed) {
      renderLogCard(feed, entry);
      updatePillsBar();
      if (autoScrollLogs) {
        feed.scrollTop = feed.scrollHeight;
      }
    }
  }

  function createOrUpdateHud(
    statusText = "Ready",
    progressText = "",
    isSolving = false,
  ) {
    let hud = document.getElementById("springbored-assignment-hud");
    if (!hud) {
      const fallbackLogoUrl =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="10" fill="#244534"/><circle cx="22" cy="22" r="13" fill="none" stroke="#e5a952" stroke-width="3.5"/><path d="M19 15l10 7-10 7V15z" fill="#e6926d"/></svg>',
        );
      let hudLogoUrl = fallbackLogoUrl;
      try {
        if (chrome?.runtime?.getURL) {
          hudLogoUrl = chrome.runtime.getURL("Assets/Logo.png");
        }
      } catch (_) {}

      hud = document.createElement("div");
      hud.id = "springbored-assignment-hud";
      hud.innerHTML = `
        <div class="sb-hud-bar" id="sbHudBar">
          <div class="sb-hud-header" id="sbHudHeader" title="Drag to move anywhere">
            <div class="sb-hud-brand">
              <img class="sb-hud-logo" id="sbHudLogo" src="${hudLogoUrl}" alt="SpringBored" />
              <span class="sb-hud-title">SpringBored</span>
              <span class="sb-hud-model" id="sbHudModel">Gemini</span>
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
                Solve assessment
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
          <div class="sb-hud-footer">
            <a
              class="sb-hud-footer-brand"
              href="https://springbored.ojasdeshpande.in/"
              target="_blank"
              rel="noopener noreferrer"
              >SpringBored</a
            >
            <span>&copy;</span>
            <span id="sbHudCopyrightYear">2026</span>
            <a
              href="https://www.ojasdeshpande.in/"
              target="_blank"
              rel="noopener noreferrer"
              >Ojas Shailesh Deshpande</a
            >
          </div>
        </div>
      `;

      const style = document.createElement("style");
      style.textContent = `
        #springbored-assignment-hud {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, Helvetica, Arial, sans-serif;
          user-select: none;
          touch-action: none;
        }
        .sb-hud-bar {
          background: linear-gradient(180deg, #244534 0%, #162b21 100%);
          border: 1px solid #355d48;
          border-top: 2px solid #e5a952;
          border-radius: 10px;
          padding: 11px 14px;
          width: 316px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
          color: #f3ebd3;
          display: flex;
          flex-direction: column;
          gap: 9px;
          transition: width 0.22s ease, max-height 0.22s ease;
        }
        #springbored-assignment-hud.sb-hud-enlarged .sb-hud-bar {
          width: 536px;
          max-width: calc(100vw - 36px);
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.68);
        }
        .sb-hud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: grab;
          padding-bottom: 7px;
          border-bottom: 1px solid #2e523f;
        }
        .sb-hud-header:active {
          cursor: grabbing;
        }
        .sb-hud-brand {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .sb-hud-logo {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          border-radius: 5px;
          object-fit: cover;
          border: 1px solid rgba(243, 235, 211, 0.55);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
          display: block;
          background: #244534;
        }
        .sb-hud-title {
          color: #f3ebd3;
          font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.2px;
        }
        .sb-hud-model {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.45px;
          text-transform: uppercase;
          background: rgba(229, 169, 82, 0.16);
          color: #e5a952;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(229, 169, 82, 0.42);
        }
        .sb-hud-header-tools {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .sb-hud-tool-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #98b09f;
          cursor: pointer;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11.5px;
          font-weight: 700;
          padding: 2px 5px;
          border-radius: 4px;
          line-height: 1;
          transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }
        .sb-hud-tool-btn:hover {
          color: #f3ebd3;
          background: #274a39;
          border-color: #3d6952;
        }
        .sb-hud-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sb-hud-status-row {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 8px;
          background: #12231a;
          border: 1px solid #294938;
          border-radius: 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10.5px;
        }
        .sb-hud-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #96c99e;
          flex-shrink: 0;
        }
        .sb-hud-dot.busy {
          background: #e6926d;
          animation: sb-pulse 1.2s infinite;
        }
        .sb-hud-status {
          color: #d4dfd0;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-hud-progress {
          font-size: 10px;
          font-weight: 700;
          color: #e5a952;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          flex-shrink: 0;
        }
        .sb-hud-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sb-hud-action-btn {
          background: linear-gradient(180deg, #eca07c 0%, #e6926d 50%, #df825a 100%);
          border: 1px solid #f3ebd3;
          border-radius: 6px;
          color: #162b21;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
        }
        .sb-hud-action-btn:hover {
          background: linear-gradient(180deg, #f2b091 0%, #eca07c 100%);
          transform: translateY(-1px);
          box-shadow: 0 5px 16px rgba(0, 0, 0, 0.35);
        }
        .sb-hud-action-btn.active {
          background: linear-gradient(180deg, #ecc071 0%, #e5a952 100%);
          border-color: #f3ebd3;
          color: #162b21;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
        }
        .sb-hud-stream-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sb-hud-stream-toggle-btn {
          background: #14271d;
          border: 1px solid #2e523f;
          color: #d4dfd0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.35px;
          padding: 5px 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .sb-hud-stream-toggle-btn:hover {
          background: rgba(229, 169, 82, 0.14);
          border-color: rgba(229, 169, 82, 0.5);
          color: #f3ebd3;
        }
        .sb-hud-stream-dot {
          color: #96c99e;
          font-size: 8px;
        }
        .sb-hud-stream-badge {
          background: rgba(229, 169, 82, 0.18);
          border: 1px solid rgba(229, 169, 82, 0.42);
          color: #e5a952;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
        }
        .sb-hud-inspector {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 2px;
          padding-top: 8px;
          border-top: 1px solid #2e523f;
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
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #e5a952;
          letter-spacing: 0.65px;
        }
        .sb-hud-insp-right {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .sb-hud-insp-subbtn {
          background: #14271d;
          border: 1px solid #2e523f;
          color: #98b09f;
          border-radius: 4px;
          padding: 2px 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          cursor: pointer;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .sb-hud-insp-subbtn:hover {
          color: #f3ebd3;
          border-color: #e5a952;
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
          background: #3d6952;
          border-radius: 4px;
        }
        .sb-hud-q-pill {
          background: #14271d;
          border: 1px solid #2e523f;
          color: #98b09f;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .sb-hud-q-pill:hover {
          background: rgba(229, 169, 82, 0.18);
          color: #f3ebd3;
          border-color: #e5a952;
        }
        .sb-hud-q-pill.active {
          background: #e5a952;
          color: #162b21;
          border-color: #f3ebd3;
          font-weight: 700;
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
          width: 4px;
        }
        .sb-hud-stream-feed::-webkit-scrollbar-thumb {
          background: #3d6952;
          border-radius: 4px;
        }
        .sb-hud-stream-placeholder {
          font-size: 10.5px;
          color: #6c8774;
          text-align: center;
          padding: 16px 8px;
          font-style: italic;
        }
        .sb-hud-card {
          background: #172d22;
          border: 1px solid #2c4e3c;
          border-radius: 6px;
          padding: 9px 11px;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .sb-hud-card.success {
          border-left: 3px solid #96c99e;
        }
        .sb-hud-card.fallback {
          border-left: 3px solid #e5a952;
        }
        .sb-hud-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sb-hud-card-qbadge {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-weight: 700;
          color: #e6926d;
          font-size: 10.5px;
        }
        .sb-hud-card-time {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          color: #6c8774;
          margin-left: 6px;
        }
        .sb-hud-card-perf {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sb-hud-card-latency {
          font-size: 9px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color: #e5a952;
          background: rgba(229, 169, 82, 0.14);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .sb-hud-card-model {
          font-size: 9px;
          color: #98b09f;
        }
        .sb-hud-card-prompt {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sb-hud-sublabel {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #6c8774;
          letter-spacing: 0.4px;
        }
        .sb-hud-prompt-text {
          background: #112219;
          border: 1px solid #264535;
          padding: 6px 8px;
          border-radius: 5px;
          color: #f3ebd3;
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
          padding: 3.5px 7px;
          border-radius: 4px;
          color: #98b09f;
          font-size: 10px;
          background: #112219;
          border: 1px solid transparent;
        }
        .sb-hud-stream-opt.chosen {
          background: rgba(132, 152, 124, 0.22);
          border-color: rgba(150, 201, 158, 0.45);
          color: #f3ebd3;
          font-weight: 600;
        }
        .sb-hud-stream-idx {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color: #e5a952;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sb-hud-stream-opt.chosen .sb-hud-stream-idx {
          color: #96c99e;
        }
        .sb-hud-stream-txt {
          flex: 1;
          word-break: break-word;
        }
        .sb-hud-stream-check {
          color: #96c99e;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sb-hud-card-reply {
          background: rgba(229, 169, 82, 0.1);
          border: 1px solid rgba(229, 169, 82, 0.32);
          border-radius: 5px;
          padding: 7px 9px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sb-hud-ans-highlight {
          color: #f3ebd3;
          font-size: 11px;
        }
        .sb-hud-ans-highlight strong {
          color: #e5a952;
        }
        .sb-hud-exp-text {
          color: #d4dfd0;
          font-size: 10px;
          line-height: 1.35;
        }
        @keyframes sb-pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .sb-hud-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 4px;
          margin-top: 2px;
          padding-top: 8px;
          border-top: 1px solid #2e523f;
          color: #98b09f;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          letter-spacing: 0.15px;
        }
        .sb-hud-footer a {
          color: #d4dfd0;
          text-decoration: none;
          border-bottom: 1px solid rgba(212, 223, 208, 0.35);
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .sb-hud-footer a:hover {
          color: #e5a952;
          border-color: #e5a952;
        }
        .sb-hud-footer-brand {
          font-weight: 700;
          color: #f3ebd3 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
      (document.body || document.documentElement).appendChild(hud);

      const hudYear = document.getElementById("sbHudCopyrightYear");
      if (hudYear) hudYear.textContent = String(new Date().getFullYear());

      const hudLogo = document.getElementById("sbHudLogo");
      if (hudLogo) {
        hudLogo.addEventListener("error", () => {
          if (hudLogo.src !== fallbackLogoUrl) {
            hudLogo.src = fallbackLogoUrl;
          }
        });
      }

      // ── Make HUD Draggable ──
      const header = document.getElementById("sbHudHeader");
      let isDragging = false;
      let startX, startY, origLeft, origTop;

      header.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        isDragging = true;
        const rect = hud.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origLeft = rect.left;
        origTop = rect.top;

        // Switch to top/left positioning for exact dragging
        hud.style.bottom = "auto";
        hud.style.right = "auto";
        hud.style.left = `${origLeft}px`;
        hud.style.top = `${origTop}px`;
        header.setPointerCapture(e.pointerId);
      });

      header.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const panelWidth = isEnlarged ? 540 : 325;
        const newLeft = Math.max(
          10,
          Math.min(window.innerWidth - panelWidth, origLeft + deltaX),
        );
        const newTop = Math.max(
          10,
          Math.min(window.innerHeight - 80, origTop + deltaY),
        );
        hud.style.left = `${newLeft}px`;
        hud.style.top = `${newTop}px`;
      });

      header.addEventListener("pointerup", (e) => {
        isDragging = false;
        try {
          header.releasePointerCapture(e.pointerId);
        } catch (_) {}
      });

      // ── Enlarge / Inspector Toggle ──
      const expandBtn = document.getElementById("sbHudExpandBtn");
      const toggleRowBtn = document.getElementById("sbHudStreamToggleBtn");
      const inspector = document.getElementById("sbHudInspector");

      function setEnlarged(enlarged) {
        isEnlarged = enlarged;
        if (isEnlarged) {
          hud.classList.add("sb-hud-enlarged");
          if (inspector) inspector.style.display = "flex";
          if (expandBtn) {
            expandBtn.textContent = "⤡";
            expandBtn.title = "Shrink / Compact Window";
          }
          if (toggleRowBtn) {
            toggleRowBtn.style.background = "rgba(229, 169, 82, 0.16)";
          }
          // Ensure enlarged window does not overflow off right screen edge
          const rect = hud.getBoundingClientRect();
          if (rect.right > window.innerWidth - 10) {
            const curLeft = parseInt(hud.style.left, 10);
            if (!isNaN(curLeft)) {
              hud.style.left = `${Math.max(10, curLeft - (rect.right - window.innerWidth + 20))}px`;
            }
          }
          const feed = document.getElementById("sbHudStreamFeed");
          if (feed && autoScrollLogs) {
            feed.scrollTop = feed.scrollHeight;
          }
        } else {
          hud.classList.remove("sb-hud-enlarged");
          if (inspector) inspector.style.display = "none";
          if (expandBtn) {
            expandBtn.textContent = "⤢";
            expandBtn.title = "Enlarge & Inspect Live Gemini AI Communication";
          }
          if (toggleRowBtn) {
            toggleRowBtn.style.background = "#14271d";
          }
        }
      }

      if (expandBtn) {
        expandBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          setEnlarged(!isEnlarged);
        });
      }

      if (toggleRowBtn) {
        toggleRowBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          setEnlarged(!isEnlarged);
        });
      }

      // Auto-scroll toggle
      const autoScrollBtn = document.getElementById("sbHudAutoScrollBtn");
      if (autoScrollBtn) {
        autoScrollBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          autoScrollLogs = !autoScrollLogs;
          autoScrollBtn.style.color = autoScrollLogs ? "#e5a952" : "#98b09f";
          autoScrollBtn.textContent = autoScrollLogs ? "↓ Auto" : "Paused";
        });
      }

      // Clear logs button
      const clearStreamBtn = document.getElementById("sbHudClearStreamBtn");
      if (clearStreamBtn) {
        clearStreamBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          aiCommunicationLogs.length = 0;
          updatePillsBar();
          const feed = document.getElementById("sbHudStreamFeed");
          if (feed) {
            feed.innerHTML = `
              <div class="sb-hud-stream-placeholder" id="sbHudPlaceholder">
                Logs cleared. New queries will appear here.
              </div>
            `;
          }
          const badge = document.getElementById("sbHudStreamBadge");
          if (badge) badge.textContent = "0";
        });
      }

      // ── Position Flip Button (Bottom-Right -> Bottom-Left -> Top-Left) ──
      const posBtn = document.getElementById("sbHudPosBtn");
      posBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        hud.style.left = "auto";
        hud.style.top = "auto";
        hud.style.bottom = "auto";
        hud.style.right = "auto";

        if (currentCorner === "bottom-right") {
          currentCorner = "bottom-left";
          hud.style.bottom = "24px";
          hud.style.left = "24px";
        } else if (currentCorner === "bottom-left") {
          currentCorner = "top-left";
          hud.style.top = "24px";
          hud.style.left = "24px";
        } else {
          currentCorner = "bottom-right";
          hud.style.bottom = "24px";
          hud.style.right = "24px";
        }
      });

      // ── Minimize Button ──
      const minBtn = document.getElementById("sbHudMinBtn");
      minBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const content = document.getElementById("sbHudContent");
        const isHidden = content.style.display === "none";
        content.style.display = isHidden ? "flex" : "none";
        minBtn.textContent = isHidden ? "_" : "□";
      });

      // ── Close Button ──
      const closeBtn = document.getElementById("sbHudCloseBtn");
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        hud.remove();
      });

      // ── Action Button ──
      const initActionBtn = document.getElementById("sbHudActionBtn");
      if (initActionBtn) {
        initActionBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isRunning) {
            log("HUD action button pressed. Starting solver...");
            startAssessmentSolver(true);
          } else {
            isPaused = !isPaused;
            sendStatus({
              status: isPaused ? "paused" : "running",
              message: isPaused ? "Paused." : "Solving assessment...",
            });
          }
        });
      }

      // Keyboard shortcuts are bound once; the HUD can be closed and recreated.
      if (!hudShortcutsBound) {
        hudShortcutsBound = true;
        window.addEventListener("keydown", (e) => {
          if (
            (e.altKey && e.key.toLowerCase() === "s") ||
            (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") ||
            e.key === "F2"
          ) {
            e.preventDefault();
            document.getElementById("sbHudActionBtn")?.click();
          }
        });
      }

      // Re-populate historical stream logs if HUD was newly created
      const streamFeed = document.getElementById("sbHudStreamFeed");
      if (streamFeed && aiCommunicationLogs.length > 0) {
        const placeholder = document.getElementById("sbHudPlaceholder");
        if (placeholder) placeholder.style.display = "none";
        const badge = document.getElementById("sbHudStreamBadge");
        if (badge) badge.textContent = String(aiCommunicationLogs.length);
        for (const item of aiCommunicationLogs) {
          renderLogCard(streamFeed, item);
        }
        updatePillsBar();
      }
    }

    const statusEl = document.getElementById("sbHudStatus");
    const progEl = document.getElementById("sbHudProg");
    const dotEl = document.getElementById("sbHudDot");
    const actionBtn = document.getElementById("sbHudActionBtn");
    const modelEl = document.getElementById("sbHudModel");

    if (modelEl && activeAnsweringModel) {
      modelEl.textContent = formatModelName(activeAnsweringModel);
    } else {
      chrome.storage.local.get(["geminiModel"], (d) => {
        if (modelEl) {
          const chosen = activeAnsweringModel || d.geminiModel || "gemini-2.5-flash";
          modelEl.textContent = formatModelName(chosen);
        }
      });
    }

    if (statusEl && statusText) statusEl.textContent = statusText;
    if (progEl) progEl.textContent = progressText;
    if (dotEl) dotEl.className = isSolving ? "sb-hud-dot busy" : "sb-hud-dot";
    if (actionBtn) {
      if (isRunning && isPaused) {
        actionBtn.textContent = "Resume solver";
        actionBtn.className = "sb-hud-action-btn active";
      } else if (isRunning) {
        actionBtn.textContent = "Pause solver";
        actionBtn.className = "sb-hud-action-btn active";
      } else {
        actionBtn.textContent = "Solve assessment";
        actionBtn.className = "sb-hud-action-btn";
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPREHENSIVE ELEMENT SEARCHERS (Searches main doc & child iframes)
  // ═══════════════════════════════════════════════════════════════════════════

  function findStartButtons(roots = getActiveDocuments()) {
    const results = [];
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll(
          'button, [role="button"], input[type="button"], a, div, span',
        ),
      ];
      for (const btn of candidates) {
        if (btn.disabled || btn.hasAttribute("disabled")) continue;
        const text = (btn.innerText || btn.textContent || btn.value || "")
          .trim()
          .replace(/\s+/g, " ");
        if (
          /^(?:start|retake|re-attempt)$/i.test(text) ||
          /^(?:start|retake|re-attempt)\s*(?:test|assessment|quiz)$/i.test(
            text,
          ) ||
          /^(?:take\s*assessment)$/i.test(text)
        ) {
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
      // 1. Find ANY button, link, div, span with "Attempt Section" / "Resume Section"
      const candidates = [
        ...root.querySelectorAll(
          'button, a, input[type="button"], [role="button"], div, span',
        ),
      ];
      for (const el of candidates) {
        if (el.disabled || el.hasAttribute("disabled")) continue;
        const rawTxt = (
          el.innerText ||
          el.textContent ||
          el.value ||
          ""
        ).trim();
        const txt = rawTxt.replace(/\s+/g, " ");
        const aria = (el.getAttribute("aria-label") || "")
          .trim()
          .replace(/\s+/g, " ");

        if (
          /^(?:attempt|resume|start)\s*section$/i.test(txt) ||
          /^(?:attempt|resume|start)\s*section$/i.test(aria) ||
          (/(?:attempt|resume)\s*section/i.test(txt) && txt.length < 40)
        ) {
          const target = el.closest('button, [role="button"], a') || el;
          if (!results.includes(target)) {
            const rect = target.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              results.push(target);
            }
          }
        }
      }

      // 2. Fallback: Search inside section card containers
      const sectionCards = [
        ...root.querySelectorAll(
          '.section-card, .section, mat-card, tr, [class*="section"]',
        ),
      ];
      for (const card of sectionCards) {
        const btns = [...card.querySelectorAll('button, [role="button"], a')];
        for (const b of btns) {
          if (b.disabled || b.hasAttribute("disabled")) continue;
          const bTxt = (b.innerText || b.textContent || "")
            .trim()
            .replace(/\s+/g, " ");
          if (
            /^(?:attempt|resume|start)$/i.test(bTxt) ||
            /(?:attempt|resume)\s*section/i.test(bTxt)
          ) {
            if (!results.includes(b)) {
              const rect = b.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                results.push(b);
              }
            }
          }
        }
      }
    }
    return results;
  }

  function sectionCardFor(button) {
    let card = button.closest(
      '.section-card, .section, mat-card, tr, [class*="section-card"], [class*="sectionCard"], [class*="assessment-section"]',
    );
    if (card) return card;

    // Never use a generic div here: closest('div') matches the button's own
    // wrapper and loses the section title/progress text.
    const buttonText = (button.innerText || button.textContent || "")
      .trim()
      .toLowerCase();
    let node = button.parentElement;
    while (node && node !== document.body) {
      const text = (node.innerText || node.textContent || "")
        .trim()
        .toLowerCase();
      if (text.length > 30 && text !== buttonText) return node;
      node = node.parentElement;
    }
    return button.parentElement;
  }

  function sectionNameFor(button) {
    const card = sectionCardFor(button);
    const text = card?.innerText || card?.textContent || "";
    const firstLine =
      text
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean) || "";
    return firstLine.slice(0, 80) || "Unnamed section";
  }

  function isSectionCardComplete(card) {
    const text = (card?.innerText || card?.textContent || "").toLowerCase();
    if (/\b100\s*%/.test(text)) return true;
    // Match a real status badge, not instructional copy such as "Complete all
    // questions" or "Not completed".
    return (
      /^\s*(completed|complete)\s*$/im.test(text) ||
      /^\s*(completed|complete)\s+(on|at|date)\b/im.test(text) ||
      /^\s*status\s*[:\-]\s*(completed|complete)\s*$/im.test(text)
    );
  }

  function findSaveButton(roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll(
          'button, input[type="button"], input[type="submit"], a, [role="button"], div, span',
        ),
      ];
      for (const btn of candidates) {
        if (btn.disabled || btn.hasAttribute("disabled")) continue;
        const text = (btn.innerText || btn.textContent || btn.value || "")
          .trim()
          .toLowerCase();
        if (
          text === "save" ||
          text === "save & next" ||
          text === "save and next" ||
          text === "next"
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

  function findFinishButton(roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll(
          'button, input[type="button"], a, [role="button"], div, span',
        ),
      ];
      for (const btn of candidates) {
        if (btn.disabled || btn.hasAttribute("disabled")) continue;
        const text = (btn.innerText || btn.textContent || btn.value || "")
          .trim()
          .toLowerCase();
        if (
          text === "finish test" ||
          text === "finish" ||
          text === "end test" ||
          text === "submit test" ||
          text === "submit" ||
          text === "submit assessment"
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
        ...root.querySelectorAll(
          'button, [role="button"], a, i, mat-icon, span, svg, div',
        ),
      ];
      for (const el of candidates) {
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        const cls = (el.className?.toString() || "").toLowerCase();
        const text = (el.innerText || el.textContent || "")
          .trim()
          .toLowerCase();

        if (
          aria.includes("back to section") ||
          aria === "back" ||
          cls.includes("back-btn") ||
          cls.includes("arrow-left") ||
          text === "arrow_back" ||
          text === "←"
        ) {
          const target = el.closest('button, a, [role="button"]') || el;
          const rect = target.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.left < 200 && rect.top < 170) {
            return target;
          }
        }
      }

      // Check for SECTIONS tab directly
      const tabs = [
        ...root.querySelectorAll('[role="tab"], .mat-tab-label, button, a'),
      ];
      for (const t of tabs) {
        if (t.textContent.trim().toLowerCase() === "sections") {
          return t;
        }
      }
    }
    return null;
  }

  function isElementRendered(el) {
    if (!el) return false;
    try {
      const win = el.ownerDocument?.defaultView || window;
      const docEl = el.ownerDocument?.documentElement || document.documentElement;
      let node = el;
      let depth = 0;
      while (node && node.nodeType === 1 && depth < 14) {
        const style = win.getComputedStyle(node);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse" ||
          parseFloat(style.opacity) === 0 ||
          node.hidden ||
          node.getAttribute("aria-hidden") === "true"
        ) {
          return false;
        }
        node = node.parentElement;
        depth++;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      return (
        rect.right > 0 &&
        rect.left < (win.innerWidth || docEl.clientWidth || 1920)
      );
    } catch (_) {
      return false;
    }
  }

  function isCircleAnswered(circleEl) {
    if (!circleEl) return false;
    const cls = (circleEl.className?.toString() || "").toLowerCase();

    // Explicitly reject unattempted / not-answered states!
    if (
      cls.includes("not-") ||
      cls.includes("not_") ||
      cls.includes("unattempted") ||
      cls.includes("unanswered") ||
      cls.includes("not-answered") ||
      cls.includes("not-attempted")
    ) {
      return false;
    }

    if (
      /\banswered\b/.test(cls) ||
      /\bcompleted\b/.test(cls) ||
      /\battempted\b/.test(cls) ||
      /\bsaved\b/.test(cls) ||
      /\bsuccess\b/.test(cls)
    ) {
      return true;
    }
    try {
      const bg = window.getComputedStyle(circleEl).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const r = parseInt(m[1], 10);
        const g = parseInt(m[2], 10);
        const b = parseInt(m[3], 10);
        // Green color indicator typical of correct/answered questions on Springboard
        if (g > 95 && g > r * 1.25 && g > b * 1.25) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function getAvailablePaletteCircles(roots = getActiveDocuments()) {
    const list = [];
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll(
          ".q-num, .circle, .question-number, .palette-item, .palette-circle, button, span, div, a",
        ),
      ];
      for (const c of candidates) {
        if (c.children.length <= 1) {
          const txt = c.textContent.trim();
          if (/^\d{1,3}$/.test(txt)) {
            const rect = c.getBoundingClientRect();
            // Sidebar palette is strictly on the left (x < 340), never in timer at top center/right
            if (
              rect.width > 0 &&
              rect.height > 0 &&
              rect.left < 340 &&
              rect.top > 60
            ) {
              const num = parseInt(txt, 10);
              if (
                num >= 1 &&
                num <= 100 &&
                !list.some((item) => item.number === num)
              ) {
                list.push({
                  number: num,
                  element: c,
                  answered: isCircleAnswered(c),
                });
              }
            }
          }
        }
      }
    }
    return list.sort((a, b) => a.number - b.number);
  }

  function hasEnterResponseToast(roots = getActiveDocuments()) {
    for (const root of roots) {
      const toasts = [
        ...root.querySelectorAll(
          '.mat-snack-bar-container, simple-snack-bar, .toast, .alert, .snackbar, [role="alert"]',
        ),
      ];
      for (const t of toasts) {
        const text = (t.innerText || t.textContent || "").toLowerCase();
        if (
          text.includes("enter your response") ||
          text.includes("select an answer") ||
          text.includes("mandatory")
        ) {
          return true;
        }
      }
    }
    return false;
  }

  async function confirmBackDialog(roots = getActiveDocuments()) {
    for (let attempt = 0; attempt < 8; attempt++) {
      await sleep(250);
      for (const root of roots) {
        const dialogs = [
          ...root.querySelectorAll(
            'mat-dialog-container, [role="dialog"], .modal, .modal-dialog, .cdk-overlay-pane',
          ),
        ];
        for (const dialog of dialogs) {
          const btns = [
            ...dialog.querySelectorAll('button, [role="button"], a'),
          ];
          for (const b of btns) {
            const txt = (b.innerText || b.textContent || "")
              .trim()
              .toLowerCase();
            if (
              (txt.includes("yes") ||
                txt.includes("leave") ||
                txt.includes("proceed") ||
                txt.includes("back") ||
                txt.includes("ok")) &&
              !txt.includes("cancel") &&
              !txt.includes("stay") &&
              !txt.includes("no")
            ) {
              log(`Confirming back-to-sections dialog: "${txt}"`);
              b.click();
              await sleep(600);
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  async function confirmStartDialog(roots = getActiveDocuments()) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await sleep(300);
      for (const root of roots) {
        const dialogs = [
          ...root.querySelectorAll(
            'mat-dialog-container, [role="dialog"], .modal, .cdk-overlay-pane',
          ),
        ];
        for (const dialog of dialogs) {
          const btns = [
            ...dialog.querySelectorAll('button, [role="button"], a'),
          ];
          for (const b of btns) {
            const txt = (b.innerText || b.textContent || "")
              .trim()
              .toLowerCase();
            if (
              (txt.includes("yes") ||
                txt.includes("start") ||
                txt.includes("proceed") ||
                txt.includes("confirm") ||
                txt.includes("ok")) &&
              !txt.includes("cancel") &&
              !txt.includes("no")
            ) {
              log(`Confirming start assessment dialog: "${txt}"`);
              b.click();
              await sleep(600);
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function clickPaletteCircle(qIndex, roots = getActiveDocuments()) {
    for (const root of roots) {
      const candidates = [
        ...root.querySelectorAll(
          ".q-num, .circle, .question-number, .palette-item, .palette-circle, button, span, div, a",
        ),
      ];
      for (const c of candidates) {
        if (c.children.length <= 1 && c.textContent.trim() === String(qIndex)) {
          const rect = c.getBoundingClientRect();
          // Must be strictly in the left sidebar palette (x < 340, top > 60)
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left < 340 &&
            rect.top > 60
          ) {
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
      // 1. Heading or question indicator in main area (left > 150) — True current question on screen!
      const candidates = [
        ...root.querySelectorAll(
          ".question-title, .question-number, h1, h2, h3, h4, h5, h6, div, span, p",
        ),
      ];
      for (const el of candidates) {
        const txt = el.textContent.trim();
        if (txt.length > 0 && txt.length < 50) {
          const match =
            txt.match(/^Question\s*[:\-\.]?\s*(\d{1,3})$/i) ||
            txt.match(/^Q(?:uestion)?\s*[:\-\.]?\s*(\d{1,3})\b/i);
          if (match) {
            const rect = el.getBoundingClientRect();
            if (rect.left > 150 && rect.width > 0 && rect.height > 0) {
              const num = parseInt(match[1], 10);
              if (num >= 1 && num <= 100) return num;
            }
          }
        }
      }

      // 2. Fallback: Palette circle with strictly active class (sidebar left < 340)
      const activeCircles = [
        ...root.querySelectorAll(
          '.active, .current, [aria-current="true"], .q-selected, .active-circle, .circle-active',
        ),
      ];
      for (const ac of activeCircles) {
        if (
          ac.classList.contains("answered") &&
          !ac.classList.contains("active")
        )
          continue;
        const txt = ac.textContent.trim();
        const m = txt.match(/^(\d{1,3})$/);
        if (m) {
          const rect = ac.getBoundingClientRect();
          if (rect.left < 340 && rect.width > 0 && rect.height > 0) {
            const num = parseInt(m[1], 10);
            if (num >= 1 && num <= 100) return num;
          }
        }
      }
    }
    return null;
  }

  async function waitForQuestionChange(prevQNum, prevSig, maxWaitMs = 3500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await sleep(150);
      const newQNum = getCurrentQuestionNumber();
      if (newQNum !== null && prevQNum !== null && newQNum !== prevQNum) {
        return true;
      }
      const qData = scrapeCurrentQuestion();
      if (qData) {
        const newSig = `${newQNum || ""}|${qData.questionText}|${qData.options.map((o) => o.text).join(",")}`;
        if (newSig !== prevSig) {
          return true;
        }
      }
    }
    return false;
  }

  function getPaletteCircleCount(roots = getActiveDocuments()) {
    const circles = getAvailablePaletteCircles(roots);
    if (circles.length > 0) return circles.length;

    // Secondary: Look for explicit total questions text e.g. "total 25 questions" within section
    for (const root of roots) {
      const bodyText = root.body?.innerText || root.body?.textContent || "";
      const m1 = bodyText.match(/total\s+(\d{1,3})\s+questions/i);
      if (m1) {
        const n = parseInt(m1[1], 10);
        if (n > 0 && n <= 100) return n;
      }
    }

    return 25; // Default fallback for Springboard assessments
  }

  function clickElementThoroughly(el) {
    if (!el) return;
    const target = el.closest('button, [role="button"], a') || el;
    try {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (_) {}

    const opts = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    target.focus?.();
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.click();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION & OPTION SCRAPER (Complete Stem, Code, Tables, and All Options)
  // ═══════════════════════════════════════════════════════════════════════════

  const IGNORED_UI_SELECTOR =
    '#springbored-assignment-hud, .palette, .question-palette, .palette-circle, .q-num, .circle, .sidebar, .left-sidebar, nav, .navbar, .modal-backdrop, .cdk-overlay-backdrop';

  function isInsideIgnoredUi(el) {
    if (!el || typeof el.closest !== 'function') return true;
    return !!el.closest(IGNORED_UI_SELECTOR);
  }

  /**
   * Walk up from a single option element to the highest wrapper that contains
   * ONLY this option and none of the sibling options.
   */
  function findHighestSingleOptionWrapper(optNode, allOptNodes, rootBody) {
    let current = optNode;
    let parent = current?.parentElement;

    while (parent && parent !== rootBody && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
      if (isInsideIgnoredUi(parent)) break;
      const containsOtherOption = allOptNodes.some(
        (other) => other !== optNode && parent.contains(other)
      );
      if (containsOtherOption) break;
      current = parent;
      parent = current.parentElement;
    }

    return current || optNode;
  }

  /**
   * Walk a live DOM subtree and extract complete text while preserving
   * multi-line <pre>/<code> indentation, <table> cells/rows, list items,
   * and paragraph/line breaks, while skipping any node in excludedSet.
   */
  function extractRichTextFromNode(rootNode, excludedSet = new Set()) {
    if (!rootNode) return '';

    const BLOCK_TAGS = new Set([
      'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'XMP',
      'TABLE', 'TR', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'HR', 'FIGCAPTION'
    ]);
    const CODE_TAGS = new Set(['PRE', 'CODE', 'XMP']);
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'META', 'LINK']);

    function isExcluded(node) {
      let cur = node;
      while (cur && cur !== rootNode) {
        if (excludedSet.has(cur)) return true;
        cur = cur.parentElement;
      }
      return excludedSet.has(rootNode);
    }

    function walk(node) {
      if (!node || isExcluded(node)) return '';

      if (node.nodeType === Node.TEXT_NODE) {
        const val = node.nodeValue || '';
        const inPre = node.parentElement?.closest?.('pre, xmp, .code-block, .code-snippet');
        return inPre ? val : val.replace(/[ \t\r\f\v]+/g, ' ');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node;
      const tag = el.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag)) return '';
      if (isInsideIgnoredUi(el)) return '';

      // Skip MathJax/KaTeX duplicate visual/screen-reader clones when we already extract the primary math node
      if (
        el.classList?.contains('mjx-assistive-mml') ||
        (el.classList?.contains('katex-html') && el.parentElement?.querySelector?.('annotation'))
      ) {
        return '';
      }

      if (tag === 'BR') return '\n';

      // Extract LaTeX from KaTeX / MathJax annotation if available
      if (el.classList?.contains('katex') || tag === 'MJX-CONTAINER' || el.classList?.contains('MathJax')) {
        const texAnnotation = el.querySelector?.('annotation[encoding*="tex"], annotation');
        if (texAnnotation && texAnnotation.textContent?.trim()) {
          return ` $${texAnnotation.textContent.trim()}$ `;
        }
        const ariaMath = (el.getAttribute?.('aria-label') || '').trim();
        if (ariaMath) return ` ${ariaMath} `;
      }

      if (!isElementRendered(el)) return '';

      if (tag === 'IMG') {
        const alt = (el.getAttribute('alt') || el.getAttribute('title') || '').trim();
        if (alt && !/^(icon|logo|avatar|image|img)$/i.test(alt)) {
          return ` [Image: ${alt}] `;
        }
        return '';
      }

      if (tag === 'TEXTAREA') {
        const val = (el.value || el.textContent || '').trim();
        return val ? `\n\`\`\`\n${val}\n\`\`\`\n` : '';
      }

      const isPreBlock =
        tag === 'PRE' ||
        tag === 'XMP' ||
        el.classList?.contains('code-block') ||
        el.classList?.contains('code-snippet');

      if (isPreBlock) {
        const rawCode = (el.innerText || el.textContent || '').replace(/\r\n/g, '\n').trim();
        return rawCode ? `\n\`\`\`\n${rawCode}\n\`\`\`\n` : '';
      }

      if (tag === 'TABLE') {
        const rows = [...el.querySelectorAll('tr')].filter((r) => !isExcluded(r));
        const rowLines = rows
          .map((row) => {
            const cells = [...row.querySelectorAll('th, td')].filter((c) => !isExcluded(c));
            return cells
              .map((c) => (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim())
              .filter(Boolean)
              .join(' | ');
          })
          .filter(Boolean);
        return rowLines.length > 0 ? `\n${rowLines.join('\n')}\n` : '';
      }

      let inner = '';
      for (const child of el.childNodes) {
        inner += walk(child);
      }

      if (CODE_TAGS.has(tag) && !el.closest('pre, xmp')) {
        const trimmedCode = inner.trim();
        if (!trimmedCode) return '';
        return trimmedCode.includes('\n') ? `\n\`\`\`\n${trimmedCode}\n\`\`\`\n` : ` \`${trimmedCode}\` `;
      }

      if (tag === 'SUP') {
        const t = inner.trim();
        return t ? `^(${t})` : '';
      }

      if (tag === 'SUB') {
        const t = inner.trim();
        return t ? `_(${t})` : '';
      }

      if (tag === 'LI') {
        const trimmedLi = inner.trim();
        return trimmedLi ? `\n- ${trimmedLi}\n` : '';
      }

      if (BLOCK_TAGS.has(tag)) {
        return `\n${inner.trim()}\n`;
      }

      return inner;
    }

    return walk(rootNode)
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function cleanLeadingOptionEnumerator(text) {
    if (!text) return '';
    let cleaned = text.trim();
    // Strip only explicit option prefixes like "(A) ", "A) ", "A. ", or "Option A: "
    // Never strip "A - B", "a.property", or "(a) =>"
    const stripped = cleaned
      .replace(/^(?:Option\s+[A-Za-z0-9]+[\.\)\:]\s+)/i, '')
      .replace(/^\([A-Da-d1-9]\)\s+(?!=)/, '')
      .replace(/^[A-Da-d][\)\.]\s+(?!=)/, '')
      .trim();
    return stripped || cleaned;
  }

  function extractCompleteOptionText(wrapperEl, rawEl, inputEl, root) {
    let text = '';

    // 1. If input has an associated external <label for="id">, check it
    if (inputEl?.id) {
      try {
        const explicitLbl = root.querySelector(`label[for="${CSS.escape(inputEl.id)}"]`);
        if (explicitLbl) {
          text = extractRichTextFromNode(explicitLbl);
        }
      } catch (_) {}
    }

    // 2. Extract from the full single-option wrapper
    if (!text && wrapperEl) {
      text = extractRichTextFromNode(wrapperEl);
    }

    // 3. Fallback to rawEl or label content selectors
    if (!text && rawEl) {
      const labelNode = rawEl.querySelector?.(
        '.mat-radio-label-content, .mat-checkbox-label, .mdc-label, label'
      );
      text = extractRichTextFromNode(labelNode || rawEl);
    }

    // 4. Final fallback to innerText/textContent
    if (!text) {
      const target = wrapperEl || rawEl;
      text = (target?.innerText || target?.textContent || '').trim();
    }

    return cleanLeadingOptionEnumerator(text);
  }

  /**
   * Extract the assessment / subject title from the sidebar or header (e.g.
   * "Assessment - Selenium Basics with C Sharp") so Gemini solves questions
   * in the exact language/domain of the test.
   */
  function extractAssessmentContext(root) {
    if (!root?.body) return '';
    try {
      const candidates = [
        ...root.querySelectorAll(
          '.assessment-title, .test-title, .quiz-title, .course-title, .sidebar h1, .sidebar h2, .sidebar h3, .sidebar h4, .sidebar p, .sidebar div, header h1, header h2, h1, h2, h3'
        ),
      ];
      for (const el of candidates) {
        if (isInsideIgnoredUi(el) && !el.closest('.sidebar, .left-sidebar, header')) continue;
        const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (
          txt.length >= 6 &&
          txt.length <= 120 &&
          (/assessment\s*[\-:]/i.test(txt) ||
            /quiz\s*[\-:]/i.test(txt) ||
            /test\s*[\-:]/i.test(txt)) &&
          !/^question\s*\d+/i.test(txt)
        ) {
          return txt;
        }
      }
      // Fallback: check left sidebar top text above palette circles
      const allEls = [...root.querySelectorAll('div, span, p, h1, h2, h3, h4')];
      for (const el of allEls) {
        if (el.children.length > 2) continue;
        const rect = el.getBoundingClientRect?.() || { left: 999, top: 999, width: 0, height: 0 };
        if (rect.width > 40 && rect.left < 320 && rect.top > 40 && rect.top < 260) {
          const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
          if (txt.length >= 8 && txt.length <= 120 && !/^\d+$/.test(txt) && !/objective questions/i.test(txt)) {
            return txt;
          }
        }
      }
    } catch (_) {}
    return '';
  }

  /**
   * Convert any diagram/code-screenshot <img> inside the question stem into
   * inline base64 data so Gemini's multimodal vision can inspect it.
   */
  function extractQuestionImages(questionCard, optionContainers) {
    const results = [];
    if (!questionCard) return results;
    try {
      const imgs = [...questionCard.querySelectorAll('img')].filter((img) => {
        if (!isElementRendered(img)) return false;
        const rect = img.getBoundingClientRect();
        if (rect.width < 36 || rect.height < 24) return false;
        for (const opt of optionContainers) {
          if (opt.wrapper?.contains(img) || opt.container?.contains(img)) return false;
        }
        return true;
      });

      for (const img of imgs.slice(0, 2)) {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('data:image/')) {
          const m = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (m && m[2].length < 2000000) {
            results.push({ mimeType: m[1], data: m[2] });
          }
          continue;
        }
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          try {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/png');
              const base64 = dataUrl.split(',')[1];
              if (base64 && base64.length < 2000000) {
                results.push({ mimeType: 'image/png', data: base64 });
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    return results;
  }
  function selectBestOptionGroup(elements, root) {
    if (!elements || elements.length < 2) return [];

    const groups = new Map();
    for (const el of elements) {
      const groupEl =
        el.closest(
          'mat-radio-group, [role="radiogroup"], .mat-mdc-radio-group, .options-container, .options-group, .question-options, .answer-options, .options, .choices, .answers, form, fieldset, ul, ol, tbody'
        ) ||
        el.parentElement?.parentElement ||
        el.parentElement ||
        root.body;

      if (!groups.has(groupEl)) groups.set(groupEl, []);
      groups.get(groupEl).push(el);
    }

    let bestGroup = [];
    let bestScore = -1;

    for (const [groupEl, items] of groups.entries()) {
      if (items.length < 2) continue;
      const rect = groupEl.getBoundingClientRect?.() || { left: 0, width: 0, height: 0 };
      // Prefer groups in the main content area (further right than a left sidebar if present)
      const areaBonus = Math.min(rect.width * rect.height, 250000) / 1000;
      const positionBonus = rect.left > 140 ? 200 : 50;
      const score = items.length * 100 + positionBonus + areaBonus;
      if (score > bestScore) {
        bestScore = score;
        bestGroup = items;
      }
    }

    return bestGroup.length >= 2 ? bestGroup : elements;
  }

  function scrapeCurrentQuestion(roots = getActiveDocuments()) {
    for (const root of roots) {
      if (!root?.body) continue;

      let rawItems = [];
      let isMultipleSelect = false;

      // ── Strategy A: Angular Material / ARIA Radio Buttons ──
      const matRadios = [
        ...root.querySelectorAll('mat-radio-button, .mat-mdc-radio-button, [role="radio"]'),
      ].filter((el) => isElementRendered(el) && !isInsideIgnoredUi(el));

      // ── Strategy B: Angular Material / ARIA Checkboxes ──
      const matCheckboxes = [
        ...root.querySelectorAll('mat-checkbox, .mat-mdc-checkbox, [role="checkbox"]'),
      ].filter((el) => isElementRendered(el) && !isInsideIgnoredUi(el));

      if (matRadios.length >= 2) {
        isMultipleSelect = false;
        rawItems = selectBestOptionGroup(matRadios, root).map((mr) => ({
          rawEl: mr,
          clickTarget: mr.querySelector('label') || mr,
          inputElement: mr.querySelector('input'),
          isCheckbox: false,
        }));
      } else if (matCheckboxes.length >= 2) {
        isMultipleSelect = true;
        rawItems = selectBestOptionGroup(matCheckboxes, root).map((mc) => ({
          rawEl: mc,
          clickTarget: mc.querySelector('label') || mc,
          inputElement: mc.querySelector('input'),
          isCheckbox: true,
        }));
      } else {
        // ── Strategy C: Native Checkbox Inputs ──
        const nativeCheckboxes = [
          ...root.querySelectorAll('input[type="checkbox"]'),
        ].filter((inp) => {
          const target = inp.closest('label, .checkbox, .option, .choice, li') || inp.parentElement || inp;
          return isElementRendered(target) && !isInsideIgnoredUi(target);
        });

        // ── Strategy D: Native Radio Inputs ──
        const nativeRadios = [
          ...root.querySelectorAll('input[type="radio"]'),
        ].filter((inp) => {
          const target = inp.closest('label, .radio, .option, .choice, li') || inp.parentElement || inp;
          return isElementRendered(target) && !isInsideIgnoredUi(target);
        });

        if (nativeCheckboxes.length >= 2) {
          isMultipleSelect = true;
          rawItems = selectBestOptionGroup(nativeCheckboxes, root).map((input) => {
            const clickTarget =
              input.closest('label, mat-checkbox, .checkbox, .option, .choice') || input;
            return {
              rawEl: clickTarget,
              clickTarget,
              inputElement: input,
              isCheckbox: true,
            };
          });
        } else if (nativeRadios.length >= 2) {
          isMultipleSelect = false;
          rawItems = selectBestOptionGroup(nativeRadios, root).map((input) => {
            const clickTarget =
              input.closest('label, mat-radio-button, .radio, .option, .choice') || input;
            return {
              rawEl: clickTarget,
              clickTarget,
              inputElement: input,
              isCheckbox: false,
            };
          });
        } else {
          // ── Strategy E: Custom Styled Choice Wrappers ──
          const customWrappers = [
            ...root.querySelectorAll(
              '.custom-control-label, .mat-radio-label, .radio-label, .option-item, .answer-option, .option, .choice'
            ),
          ].filter((cw) => isElementRendered(cw) && !isInsideIgnoredUi(cw));

          if (customWrappers.length >= 2 && customWrappers.length <= 10) {
            rawItems = selectBestOptionGroup(customWrappers, root).map((cw) => ({
              rawEl: cw,
              clickTarget: cw,
              inputElement: cw.querySelector('input'),
              isCheckbox: false,
            }));
          }
        }
      }

      if (rawItems.length < 2) continue;

      const allRawNodes = rawItems.map((item) => item.rawEl);

      // Build optionContainers with full single-option wrappers and complete option text
      const optionContainers = rawItems.map((item, idx) => {
        const wrapper = findHighestSingleOptionWrapper(item.rawEl, allRawNodes, root.body);
        const text = extractCompleteOptionText(wrapper, item.rawEl, item.inputElement, root) || `Option ${idx + 1}`;
        return {
          element: item.clickTarget,
          container: item.rawEl,
          wrapper,
          inputElement: item.inputElement,
          text,
          isCheckbox: item.isCheckbox,
        };
      });

      // ── Find the Full Question Panel (Containing BOTH Stem/Code AND Options) ──
      // Start from the lowest common ancestor of all option wrappers
      let optionsLca = optionContainers[0].wrapper || optionContainers[0].element;
      for (const opt of optionContainers) {
        const node = opt.wrapper || opt.element;
        while (optionsLca && node && !optionsLca.contains(node)) {
          optionsLca = optionsLca.parentElement;
        }
      }
      if (!optionsLca) optionsLca = root.body;

      const excludedForQuestion = new Set();
      for (const opt of optionContainers) {
        if (opt.wrapper) excludedForQuestion.add(opt.wrapper);
        if (opt.container) excludedForQuestion.add(opt.container);
        if (opt.element) excludedForQuestion.add(opt.element);
      }

      // Walk up from optionsLca to find the full question container that holds the
      // complete question stem (never stopping on an options-only <form> or wrapper)
      let questionCard = optionsLca;
      let cur = optionsLca;

      while (cur && cur !== root.body && cur.tagName !== 'BODY' && cur.tagName !== 'HTML') {
        const parent = cur.parentElement;
        if (!parent || parent === root.body || parent.tagName === 'BODY') {
          questionCard = cur;
          break;
        }

        // Stop before an ancestor that merges the left sidebar question palette
        const paletteInParent = parent.querySelectorAll(
          '.palette-circle, .question-palette, .q-num, .circle'
        );
        if (paletteInParent.length >= 3 || getAvailablePaletteCircles([parent]).length >= 2) {
          questionCard = cur;
          break;
        }

        // Also stop if `cur` is the right-hand question column and `parent` spans across the left sidebar
        const curRect = cur.getBoundingClientRect?.() || { left: 0 };
        const parentRect = parent.getBoundingClientRect?.() || { left: 0 };
        if (curRect.left > 140 && parentRect.left < 60) {
          questionCard = cur;
          break;
        }

        // Check how much non-option question text `cur` already has
        const probeSet = new Set(excludedForQuestion);
        cur
          .querySelectorAll(
            'button, [role="button"], input[type="button"], input[type="submit"], .actions, .action-buttons, .timer, .time-left'
          )
          .forEach((b) => probeSet.add(b));
        const probeText = extractRichTextFromNode(cur, probeSet)
          .replace(/^Question\s*[:\-\.]?\s*\d+\s*(?:of\s+\d+)?/i, '')
          .trim();

        const isKnownFullQuestionWrapper = cur.matches?.(
          '.question-container, .question-view, .assessment-question, .question-card, .test-question, .question-panel'
        );

        if (isKnownFullQuestionWrapper && probeText.length >= 20) {
          questionCard = cur;
          break;
        }

        cur = parent;
        questionCard = cur;
      }

      // Exclude action buttons, timers, and option radio groups from question stem extraction
      questionCard
        .querySelectorAll(
          'mat-radio-group, [role="radiogroup"], button, [role="button"], input[type="button"], input[type="submit"], .actions, .action-buttons, .timer, .time-left, .breadcrumb'
        )
        .forEach((el) => {
          // Only exclude mat-radio-group/[role=radiogroup] if it does not wrap the question stem itself
          if (el.matches('mat-radio-group, [role="radiogroup"]')) {
            excludedForQuestion.add(el);
          } else if (!el.querySelector('pre, code')) {
            excludedForQuestion.add(el);
          }
        });

      let questionText = extractRichTextFromNode(questionCard, excludedForQuestion);

      // Clean assessment boilerplate while keeping the entire question intact
      questionText = questionText
        .replace(/^Question\s*[:\-\.]?\s*\d+\s*(?:of\s+\d+)?[\s\:\.\-]*/i, '')
        .replace(/^\d+\s+of\s+\d+\s+attempted\s*/i, '')
        .replace(/^OBJECTIVE QUESTIONS\s*/i, '')
        .replace(/\b\d{1,2}\s*:\s*\d{2}\s*:\s*\d{2}\s*(?:Hours|Minutes|Seconds|hrs|mins|secs)?\b/gi, '')
        .trim();

      // Ensure any <pre>/<code>/<xmp> blocks inside questionCard (outside options) are included
      const questionCodeEls = [
        ...questionCard.querySelectorAll('pre, code, xmp, .code-snippet, .code-block, textarea'),
      ].filter((codeEl) => {
        if (!isElementRendered(codeEl)) return false;
        for (const opt of optionContainers) {
          if (opt.wrapper?.contains(codeEl) || opt.container?.contains(codeEl)) return false;
        }
        return true;
      });

      for (const codeEl of questionCodeEls) {
        const snippet = (codeEl.value || codeEl.innerText || codeEl.textContent || '').trim();
        if (snippet && snippet.length > 3) {
          const firstLine = snippet.split('\n')[0].trim();
          if (firstLine && !questionText.includes(firstLine)) {
            questionText = `${questionText}\n\n\`\`\`\n${snippet}\n\`\`\``;
          }
        }
      }

      // Fallback if question stem is in a preceding sibling container outside questionCard
      if (!questionText || questionText.length < 8) {
        let prev = questionCard.previousElementSibling;
        const siblingParts = [];
        while (prev) {
          if (isElementRendered(prev) && !isInsideIgnoredUi(prev)) {
            const t = extractRichTextFromNode(prev, excludedForQuestion);
            if (t) siblingParts.unshift(t);
          }
          prev = prev.previousElementSibling;
        }
        if (siblingParts.length > 0) {
          questionText = `${siblingParts.join('\n\n')}\n\n${questionText}`.trim();
        }
      }

      if (!isMultipleSelect) {
        isMultipleSelect =
          optionContainers.some((o) => o.isCheckbox) ||
          !!questionCard.querySelector(
            'input[type="checkbox"], mat-checkbox, .mat-mdc-checkbox, [role="checkbox"]'
          ) ||
          /select all that apply|choose all that apply|multiple correct|more than one correct/i.test(
            questionText
          );
      }

      const assessmentContext = extractAssessmentContext(root);
      const images = extractQuestionImages(questionCard, optionContainers);

      return {
        questionText: questionText || 'Multiple choice question',
        options: optionContainers,
        isMultipleSelect,
        assessmentContext,
        images,
        rootDocument: root,
      };
    }

    return null;
  }

  // Genuine Angular-compatible option selection (supports radio & checkbox)
  function selectOption(opt) {
    if (!opt) return false;
    const target = opt.element;
    const isCheckbox =
      opt.isCheckbox ||
      !!target.closest('mat-checkbox, [role="checkbox"], .checkbox');
    const container =
      opt.container ||
      target.closest(
        isCheckbox
          ? 'mat-checkbox, [role="checkbox"]'
          : 'mat-radio-button, [role="radio"]',
      ) ||
      target;
    const input =
      opt.inputElement ||
      (target.tagName === "INPUT" ? target : container.querySelector("input"));
    const label = container.querySelector("label") || target;

    // Checkboxes toggle on every click. If this answer is already checked, leave
    // it alone; clicking again would clear a correct selection on a retry.
    if (isCheckbox && isOptionActuallyChecked(opt)) return true;

    try {
      (container || target).scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    } catch (_) {}

    // 1. ALWAYS thoroughly click the visible label / container FIRST.
    // In Angular Material and Springboard, the component listens for click on the host / label!
    const primaryTarget =
      label && label !== input ? label : container || target;
    clickElementThoroughly(primaryTarget);

    // 2. Also ensure the underlying input is clicked and checked for reactive forms
    if (input) {
      if (!input.checked && !isCheckbox) {
        input.focus?.();
        input.click();
      }
      if (!isCheckbox && !input.checked) {
        input.checked = true;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
  }

  function isOptionActuallyChecked(opt) {
    if (!opt) return false;
    const container = opt.container || opt.element;
    const input = opt.inputElement || container?.querySelector?.("input");
    if (input && input.checked) return true;
    if (
      container &&
      (container.classList?.contains("mat-radio-checked") ||
        container.classList?.contains("mat-checkbox-checked") ||
        container.getAttribute?.("aria-checked") === "true")
    ) {
      return true;
    }
    return false;
  }

  function isAnyOptionChecked(options) {
    if (!Array.isArray(options) || options.length === 0) return false;
    return options.some((opt) => isOptionActuallyChecked(opt));
  }

  /**
   * Select every target option index and verify that the DOM radio/checkbox
   * state actually became checked before clicking Save.
   */
  async function ensureOptionsSelected(options, selectedIndices) {
    for (const idx of selectedIndices) {
      const opt = options[idx];
      if (!opt) continue;
      selectOption(opt);
      await sleep(160);

      if (!isOptionActuallyChecked(opt)) {
        // Retry with wrapper / inner label / inputElement if first click did not register
        const retryTargets = [
          opt.element,
          opt.container,
          opt.wrapper?.querySelector?.('label, .mat-radio-label, .mat-checkbox-layout, input'),
          opt.inputElement,
        ].filter(Boolean);

        for (const rt of retryTargets) {
          clickElementThoroughly(rt);
          await sleep(120);
          if (isOptionActuallyChecked(opt)) break;
        }
      }
    }
  }

  /**
   * Multiple-select questions keep their checked state when the palette moves
   * between questions. Clear anything the new answer does not include before
   * applying Gemini's choice.
   */
  async function clearUnselectedCheckboxes(options, selectedIndices) {
    const keep = new Set(selectedIndices);
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (!opt || !opt.isCheckbox || keep.has(i)) continue;
      if (isOptionActuallyChecked(opt)) {
        clickElementThoroughly(opt.element);
        await sleep(80);
      }
    }
  }

  async function confirmSubmitDialog(roots = getActiveDocuments()) {
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(350);
      for (const root of roots) {
        const dialogs = [
          ...root.querySelectorAll(
            'mat-dialog-container, [role="dialog"], .modal, .modal-dialog, .cdk-overlay-pane',
          ),
        ];

        for (const dialog of dialogs) {
          const rect = dialog.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const btns = [
            ...dialog.querySelectorAll(
              'button, [role="button"], a, input[type="button"]',
            ),
          ];
          for (const b of btns) {
            if (b.disabled || b.hasAttribute("disabled")) continue;
            const txt = (b.innerText || b.textContent || b.value || "")
              .trim()
              .toLowerCase();
            if (
              (txt.includes("yes") ||
                txt.includes("confirm") ||
                txt.includes("submit") ||
                txt.includes("finish") ||
                txt.includes("ok")) &&
              !txt.includes("cancel") &&
              !txt.includes("no")
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

  let solverLockHeld = false;
  let isStarting = false;
  let pendingStop = false;

  /**
   * The service worker owns the lock so separate frames cannot start two
   * solvers at once. The in-window flag is only a fallback for worker restarts.
   */
  async function acquireSolverLock(force = false) {
    try {
      const res = await new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(value);
        };
        timer = setTimeout(() => finish(null), 2000);
        chrome.runtime.sendMessage(
          { type: "ACQUIRE_SOLVER_LOCK", force: !!force },
          (value) => {
            void chrome.runtime.lastError;
            finish(value ?? null);
          },
        );
      });
      if (res && res.granted === true) {
        solverLockHeld = true;
        return true;
      }
      if (res && res.granted === false && !force) {
        return false;
      }
    } catch (_) {}

    try {
      const topWin = window.top || window;
      const now = Date.now();
      const activeAt = topWin.__SPB_SOLVER_ACTIVE_AT__ || 0;
      if (!force && topWin.__SPB_SOLVER_ACTIVE__ && now - activeAt < 15000) {
        return false;
      }
      topWin.__SPB_SOLVER_ACTIVE__ = true;
      topWin.__SPB_SOLVER_ACTIVE_AT__ = now;
      solverLockHeld = true;
      return true;
    } catch (_) {
      solverLockHeld = true;
      return true;
    }
  }

  function releaseSolverLock() {
    if (!solverLockHeld) return;
    solverLockHeld = false;
    try {
      chrome.runtime
        .sendMessage({ type: "RELEASE_SOLVER_LOCK", force: true })
        .catch(() => {});
    } catch (_) {}
    try {
      const topWin = window.top || window;
      topWin.__SPB_SOLVER_ACTIVE__ = false;
      topWin.__SPB_SOLVER_ACTIVE_AT__ = 0;
    } catch (_) {}
  }

  async function startAssessmentSolver(force = false) {
    // If this is a same-origin child iframe, delegate to window.top so the
    // top window coordinates the run and renders a single HUD.
    if (!force && isSameOriginChildFrame()) {
      try {
        if (typeof window.top.__SPRINGBORED_START_SOLVER__ === "function") {
          window.top.__SPRINGBORED_START_SOLVER__(true);
          return;
        }
      } catch (_) {}
      return;
    }

    if (isRunning || isStarting) return;
    isStarting = true;
    pendingStop = false;

    let foundAssessment = hasAssessmentDom();
    for (let i = 0; i < 10 && !foundAssessment; i++) {
      await sleep(250);
      foundAssessment = hasAssessmentDom();
    }
    if (!foundAssessment && !force) {
      log("No assessment interface in this frame; start ignored.");
      isStarting = false;
      return;
    }

    if (!(await acquireSolverLock(force || window === window.top))) {
      log(
        "Another frame is already executing the solver. Ignoring duplicate request.",
      );
      isStarting = false;
      return;
    }

    // STOP can arrive while the DOM check or lock request is in flight.
    if (pendingStop) {
      log("Stop requested during startup. Solver did not start.");
      pendingStop = false;
      isStarting = false;
      releaseSolverLock();
      return;
    }

    try {
      log("Starting Gemini assessment solver...");
      isRunning = true;
      isPaused = false;
      solverAbortedForFailure = false;
      lastProgress = { completed: 0, total: 0 };
      sendStatus({ status: "running", message: "Initializing Gemini..." });

      const { aiQuizEnabled, geminiApiKey } = await chrome.storage.local.get([
        "aiQuizEnabled",
        "geminiApiKey",
      ]);

      if (!isRunning) return;

      if (aiQuizEnabled === false || !geminiApiKey) {
        const err =
          "Gemini API Key missing! Paste your key in extension settings & click Save & Test.";
        sendStatus({ status: "error", message: err });
        return;
      }

      // ── STEP 1: Handle Instructions Screen (if Start / Retake button present) ──
      const startBtns = findStartButtons();
      if (startBtns.length > 0) {
        log(
          `Clicking Start/Retake button: "${startBtns[0].textContent.trim()}"`,
        );
        clickElementThoroughly(startBtns[0]);
        await confirmStartDialog();
        // Poll for up to 15 seconds for sections or questions to load
        for (let w = 0; w < 30; w++) {
          if (!isRunning) break;
          await sleep(500);
          if (
            findAttemptSectionButtons().length > 0 ||
            scrapeCurrentQuestion()
          ) {
            break;
          }
        }
      }

      // ── STEP 2: Multi-Section Attempt Loop ──
      let totalQuestionsAnswered = 0;
      let sectionCount = 0;
      const completedSections = new Set();
      const attemptedSections = new Set();

      while (isRunning) {
        while (isRunning && isPaused) {
          await sleep(400);
        }

        // Look for available "Attempt Section" / "Resume Section" buttons across all documents
        let sectionButtons = findAttemptSectionButtons().filter((btn) => {
          const card = sectionCardFor(btn);
          const name = sectionNameFor(btn);
          if (completedSections.has(name) || attemptedSections.has(name))
            return false;
          if (isSectionCardComplete(card)) {
            completedSections.add(name);
            return false;
          }
          return true;
        });

        // If no section buttons yet and not on a question screen, poll for up to 5 seconds
        if (sectionButtons.length === 0 && !scrapeCurrentQuestion()) {
          for (let r = 0; r < 10; r++) {
            if (!isRunning) break;
            await sleep(500);
            sectionButtons = findAttemptSectionButtons().filter((btn) => {
              const card = sectionCardFor(btn);
              const name = sectionNameFor(btn);
              if (completedSections.has(name) || attemptedSections.has(name))
                return false;
              return !isSectionCardComplete(card);
            });
            if (sectionButtons.length > 0 || scrapeCurrentQuestion()) break;
          }
        }

        if (sectionButtons.length > 0) {
          sectionCount++;
          const currentSectionBtn = sectionButtons[0];
          const sectionName = sectionNameFor(currentSectionBtn);

          log(`Entering Section ${sectionCount}: ${sectionName}...`);
          sendStatus({
            status: "running",
            message: `Entering Section ${sectionCount}...`,
          });

          clickElementThoroughly(currentSectionBtn);

          // Wait up to 10 seconds for question DOM to render inside this section
          let questionReady = false;
          for (let qw = 0; qw < 20; qw++) {
            if (!isRunning) break;
            await sleep(500);
            if (scrapeCurrentQuestion()) {
              questionReady = true;
              break;
            }
          }

          if (questionReady) {
            // Solve all questions inside this section
            const answeredInSection =
              await solveCurrentSectionQuestions(sectionName);
            totalQuestionsAnswered += answeredInSection;
            completedSections.add(sectionName);

            // Return back to Sections screen via Back Arrow or Sections Tab
            log(
              `Section ${sectionName} complete (${answeredInSection} answered). Returning to Sections screen...`,
            );
            const backBtn = findBackButtonToSections();
            if (backBtn) {
              clickElementThoroughly(backBtn);
              await sleep(600);
              await confirmBackDialog(); // Confirm any "Leave section" dialog!

              // Wait up to 6 seconds for sections screen to render
              for (let bw = 0; bw < 15; bw++) {
                await sleep(400);
                if (findAttemptSectionButtons().length > 0) break;
              }
            } else {
              await sleep(1500);
            }
          } else if (isRunning) {
            // Do not keep clicking the same unreadable section forever. Leave it
            // unattempted so the submission guard still blocks finishing.
            attemptedSections.add(sectionName);
            log(
              `Section "${sectionName}" did not render any readable questions. Moving on without submitting it.`,
            );
          }

          continue;
        }

        // If directly on a question screen without section buttons (single-section assessment):
        const qData = scrapeCurrentQuestion();
        if (qData) {
          log(
            "Single section assessment detected. Solving questions directly...",
          );
          const answered = await solveCurrentSectionQuestions("Assessment");
          totalQuestionsAnswered += answered;
        }

        break;
      }

      // ── STEP 3: Finish & Submit Test (SAFETY GUARDED) ──
      if (solverAbortedForFailure) {
        const msg =
          lastAbortErrorMessage ||
          "Solver stopped because Gemini did not return an answer. No guess was saved and the test was not submitted.";
        log(msg);
        sendStatus({ status: "error", message: msg });
        return;
      }

      // A stop request while a section was being solved must never fall through
      // to submission just because some answers were already saved.
      if (!isRunning) {
        log("Solver stopped before submission. Nothing was submitted.");
        return;
      }

      if (totalQuestionsAnswered === 0) {
        const msg =
          "No questions were answered. Solver stopped without submitting to protect your score.";
        log(msg);
        sendStatus({ status: "stopped", message: msg });
        return;
      }

      // Block submission if unattempted sections remain!
      const remainingSections = findAttemptSectionButtons().filter((btn) => {
        const card = sectionCardFor(btn);
        const name = sectionNameFor(btn);
        if (completedSections.has(name)) return false;
        if (isSectionCardComplete(card)) return false;
        return true;
      });

      if (remainingSections.length > 0) {
        const warn = `${remainingSections.length} section(s) still remain unattempted. Submission blocked to protect your score.`;
        log(warn);
        sendStatus({ status: "stopped", message: warn });
        return;
      }

      log(
        `All questions solved (${totalQuestionsAnswered} answered across ${sectionCount || 1} section(s)). Submitting assessment...`,
      );
      sendStatus({
        status: "running",
        message: "Submitting completed assessment...",
      });
      await sleep(1500);

      const finishBtn = findFinishButton();
      if (finishBtn) {
        log(`Clicking Finish button: "${finishBtn.textContent.trim()}"`);
        clickElementThoroughly(finishBtn);
        await sleep(1500);
        await confirmSubmitDialog();
      }

      const finalMsg = `Assessment complete. Solved ${totalQuestionsAnswered} questions across ${sectionCount || 1} section(s).`;
      log(finalMsg);
      emitTelemetry("assessment_completed", {
        assessments: 1,
        sections: sectionCount || 1,
        totalQuestionsInAssessment: totalQuestionsAnswered,
      });
      sendStatus({
        status: "done",
        message: finalMsg,
        completed: totalQuestionsAnswered,
        total: totalQuestionsAnswered,
        quizzes: 1,
      });
    } finally {
      isRunning = false;
      isStarting = false;
      pendingStop = false;
      releaseSolverLock();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION QUESTION SOLVER
  // ═══════════════════════════════════════════════════════════════════════════

  async function solveCurrentSectionQuestions(sectionName = "Section") {
    // Detect all question circles in the left sidebar palette
    let circles = getAvailablePaletteCircles();
    let totalQuestions = circles.length;

    if (totalQuestions === 0) {
      // Fallback: Check for total text e.g. "total 25 questions" or "X of Y attempted"
      const allDocs = getActiveDocuments();
      for (const d of allDocs) {
        const matchTotal = (d.body?.textContent || "").match(
          /(\d+)\s+of\s+(\d+)\s+attempted/i,
        );
        if (matchTotal) {
          totalQuestions = parseInt(matchTotal[2], 10);
          break;
        }
      }
      if (!totalQuestions) totalQuestions = 25;
    }

    log(
      `[${sectionName}] Questions detected: ${totalQuestions} (${circles.length > 0 ? circles.map((c) => c.number).join(", ") : "sequential"})`,
    );

    const answeredSet = new Set();
    let questionsSolvedCount = 0;
    let lastScrapedSignature = '';

    function buildScrapeSignature(q) {
      if (!q || !q.questionText || !Array.isArray(q.options)) return '';
      return `${q.questionText.trim()}||${q.options.map((o) => (o.text || '').trim()).join('||')}`;
    }

    // Palette-driven solving (guarantees every single question is visited & answered)
    if (circles.length > 0) {
      for (let i = 0; i < circles.length; i++) {
        if (!isRunning) break;
        while (isRunning && isPaused) {
          await sleep(300);
        }
        if (!isRunning) break;

        // Refresh circle list
        circles = getAvailablePaletteCircles();
        const cInfo = circles[i];
        if (!cInfo) continue;

        const qNum = cInfo.number;

        // Skip if already answered
        if (isCircleAnswered(cInfo.element)) {
          answeredSet.add(qNum);
          continue;
        }

        // Navigate to question by clicking its palette circle
        log(`[${sectionName}] Navigating to Question ${qNum}...`);
        clickElementThoroughly(cInfo.element);

        // Wait until the question DOM has updated AND stabilized across two checks
        let qData = null;
        let prevCandidateSig = '';
        for (let w = 0; w < 22; w++) {
          await sleep(220);
          const candidate = scrapeCurrentQuestion();
          if (!candidate || !candidate.options || candidate.options.length < 2) {
            prevCandidateSig = '';
            continue;
          }
          const candSig = buildScrapeSignature(candidate);
          // If we already scraped a previous question, wait until the DOM actually switches
          // (unless we have waited > 2.6s and the exam legitimately has a duplicate question).
          if (lastScrapedSignature && candSig === lastScrapedSignature && w < 12) {
            if (w === 5 || w === 9) {
              clickElementThoroughly(cInfo.element);
            }
            prevCandidateSig = '';
            continue;
          }
          // Require two consecutive identical scrapes so we never read a half-updated DOM
          if (candSig && candSig === prevCandidateSig) {
            qData = candidate;
            break;
          }
          prevCandidateSig = candSig;
          qData = candidate;
        }

        if (!qData || !qData.options || qData.options.length < 2) {
          log(`Retrying palette circle for Question ${qNum}...`);
          clickElementThoroughly(cInfo.element);
          await sleep(800);
          qData = scrapeCurrentQuestion();
        }

        if (!qData || !qData.options || qData.options.length < 2) {
          log(`Unable to scrape Question ${qNum}. Advancing.`);
          continue;
        }

        lastScrapedSignature = buildScrapeSignature(qData);

        log(
          `[${qNum}/${totalQuestions}] Asking Gemini AI (${qData.options.length} options, Type: ${qData.isMultipleSelect ? 'Multiple' : 'Single'}): "${qData.questionText.slice(0, 80)}..."`
        );
        sendStatus({
          status: "running",
          message: `[${qNum}/${totalQuestions}] Gemini: ${qData.questionText.slice(0, 34)}...`,
          completed: answeredSet.size,
          total: totalQuestions,
          quizzes: 1,
        });

        // ── Call Gemini AI (with rate limit guard) ──
        const now = Date.now();
        const elapsed = now - lastApiCallTime;
        if (elapsed < MIN_API_INTERVAL_MS) {
          await sleep(MIN_API_INTERVAL_MS - elapsed);
        }
        lastApiCallTime = Date.now();

        const startTime = performance.now();
        const geminiRes = await requestGeminiAnswer({
          question: qData.questionText,
          options: qData.options.map((o) => o.text),
          isMultipleSelect: qData.isMultipleSelect,
          assessmentContext: qData.assessmentContext || sectionName,
          images: qData.images || [],
        });
        const latencyMs = Math.round(performance.now() - startTime);

        let selectedIndices = [];
        let selectedText = "";
        let answerRes = geminiRes;

        if (
          geminiRes?.success &&
          Array.isArray(geminiRes.selected_indices) &&
          geminiRes.selected_indices.length > 0
        ) {
          log(
            `Gemini selected: [${geminiRes.selected_indices.join(", ")}] (${geminiRes.explanation || ""})`,
          );
          selectedIndices = geminiRes.selected_indices;
        } else {
          log(
            `Gemini failed (${geminiRes?.error || "no indices"}). Retrying once...`,
          );
          await sleep(1200);
          const retryRes = await requestGeminiAnswer({
            question: qData.questionText,
            options: qData.options.map((o) => o.text),
            isMultipleSelect: qData.isMultipleSelect,
            assessmentContext: qData.assessmentContext || sectionName,
            images: qData.images || [],
          });
          answerRes = retryRes || geminiRes;

          if (
            retryRes?.success &&
            Array.isArray(retryRes.selected_indices) &&
            retryRes.selected_indices.length > 0
          ) {
            selectedIndices = retryRes.selected_indices;
          } else {
            const reason =
              retryRes?.error || geminiRes?.error || "no answer returned";
            lastAbortErrorMessage = `Gemini failed on Q${qNum}: ${reason}`;
            log(
              `Gemini could not answer Q${qNum}: ${reason}. Stopping before a guess is saved.`,
            );
            appendAiCommunicationLog({
              questionNumber: qNum,
              totalQuestions: totalQuestions,
              questionText: qData.questionText,
              options: qData.options.map((o) => o.text),
              isMultipleSelect: qData.isMultipleSelect,
              selectedIndices: [],
              selectedText: "None (Stopped)",
              explanation: `Error: ${reason}`,
              model: answerRes?.model || "Gemini",
              latencyMs,
              timestamp: new Date().toLocaleTimeString(),
              status: "fallback",
            });
            sendStatus({
              status: "error",
              message: lastAbortErrorMessage,
            });
            solverAbortedForFailure = true;
            isRunning = false;
            break;
          }
        }

        if (qData.isMultipleSelect) {
          await clearUnselectedCheckboxes(qData.options, selectedIndices);
        }

        // Stop may arrive while the API call is in flight.
        if (!isRunning) break;

        await ensureOptionsSelected(qData.options, selectedIndices);
        selectedText = selectedIndices
          .map((i) => qData.options[i]?.text || `[${i}]`)
          .join("; ");

        // Live Inspector Log
        appendAiCommunicationLog({
          questionNumber: qNum,
          totalQuestions: totalQuestions,
          questionText: qData.questionText,
          options: qData.options.map((o) => o.text),
          isMultipleSelect: qData.isMultipleSelect,
          selectedIndices,
          selectedText,
          explanation: answerRes?.explanation || "",
          model: answerRes?.model || "unknown",
          latencyMs,
          timestamp: new Date().toLocaleTimeString(),
          status: answerRes?.success ? "success" : "fallback",
        });

        // Allow Angular Reactive Form 350ms to digest selection
        await sleep(350);

        // ── Save Answer ──
        const saveBtn = findSaveButton([qData.rootDocument]);
        if (saveBtn) {
          log(`Saving answer for question ${qNum}...`);
          clickElementThoroughly(saveBtn);
          await sleep(600);

          // If toast "Please enter your response to save" appears, retry selection & save
          if (hasEnterResponseToast()) {
            log(
              `"Please enter your response" toast detected for Q${qNum}. Re-clicking option and re-saving...`,
            );
            for (const idx of selectedIndices) {
              if (qData.options[idx]) {
                selectOption(qData.options[idx]);
                await sleep(250);
              }
            }
            clickElementThoroughly(saveBtn);
            await sleep(600);
          }
        }

        answeredSet.add(qNum);
        questionsSolvedCount++;
        emitTelemetry("question_solved", {
          questions: 1,
          savedSeconds: 90,
          useTimeSeconds: Math.max(1, Math.round(latencyMs / 1000) + 2),
          model: answerRes?.model || activeAnsweringModel || "gemini-2.5-flash",
          latencyMs,
        });

        // Wait up to 2 seconds for circle to show answered/green
        for (let gw = 0; gw < 5; gw++) {
          if (isCircleAnswered(cInfo.element)) break;
          await sleep(400);
        }
      }
    } else {
      // Sequential fallback for pages without sidebar palette
      let consecutiveNoQuestion = 0;
      let lastHandledSig = "";

      while (isRunning) {
        while (isRunning && isPaused) {
          await sleep(300);
        }
        if (!isRunning) break;

        const domQNum = getCurrentQuestionNumber();
        const qData = scrapeCurrentQuestion();

        if (!qData || !qData.options || qData.options.length < 2) {
          consecutiveNoQuestion++;
          if (consecutiveNoQuestion > 20) break;
          await sleep(400);
          continue;
        }

        consecutiveNoQuestion = 0;
        const effectiveQNum = domQNum || answeredSet.size + 1;
        const qSig = `${effectiveQNum}|${qData.questionText}|${qData.options.map((o) => o.text).join(",")}`;

        if (qSig === lastHandledSig && answeredSet.has(effectiveQNum)) {
          break;
        }

        // Rate limit guard for sequential solver
        const seqNow = Date.now();
        const seqElapsed = seqNow - lastApiCallTime;
        if (seqElapsed < MIN_API_INTERVAL_MS) {
          await sleep(MIN_API_INTERVAL_MS - seqElapsed);
        }
        lastApiCallTime = Date.now();

        const seqStartTime = performance.now();
        const geminiRes = await requestGeminiAnswer({
          question: qData.questionText,
          options: qData.options.map((o) => o.text),
          isMultipleSelect: qData.isMultipleSelect,
          assessmentContext: qData.assessmentContext || sectionName,
          images: qData.images || [],
        });
        const seqLatencyMs = Math.round(performance.now() - seqStartTime);

        let selectedIndices = [];
        let selectedText = "";
        let answerRes = geminiRes;

        if (
          geminiRes?.success &&
          Array.isArray(geminiRes.selected_indices) &&
          geminiRes.selected_indices.length > 0
        ) {
          selectedIndices = geminiRes.selected_indices;
        } else {
          await sleep(1200);
          const retryRes = await requestGeminiAnswer({
            question: qData.questionText,
            options: qData.options.map((o) => o.text),
            isMultipleSelect: qData.isMultipleSelect,
            assessmentContext: qData.assessmentContext || sectionName,
            images: qData.images || [],
          });
          answerRes = retryRes || geminiRes;

          if (
            retryRes?.success &&
            Array.isArray(retryRes.selected_indices) &&
            retryRes.selected_indices.length > 0
          ) {
            selectedIndices = retryRes.selected_indices;
          } else {
            const reason =
              retryRes?.error || geminiRes?.error || "no answer returned";
            lastAbortErrorMessage = `Gemini failed on Q${effectiveQNum}: ${reason}`;
            log(
              `Gemini could not answer Q${effectiveQNum}: ${reason}. Stopping before a guess is saved.`,
            );
            appendAiCommunicationLog({
              questionNumber: effectiveQNum,
              totalQuestions: 0,
              questionText: qData.questionText,
              options: qData.options.map((o) => o.text),
              isMultipleSelect: qData.isMultipleSelect,
              selectedIndices: [],
              selectedText: "None (Stopped)",
              explanation: `Error: ${reason}`,
              model: answerRes?.model || "Gemini",
              latencyMs: seqLatencyMs,
              timestamp: new Date().toLocaleTimeString(),
              status: "fallback",
            });
            sendStatus({
              status: "error",
              message: lastAbortErrorMessage,
            });
            solverAbortedForFailure = true;
            isRunning = false;
            break;
          }
        }

        if (qData.isMultipleSelect) {
          await clearUnselectedCheckboxes(qData.options, selectedIndices);
        }

        if (!isRunning) break;

        await ensureOptionsSelected(qData.options, selectedIndices);
        selectedText = selectedIndices
          .map((i) => qData.options[i]?.text || `[${i}]`)
          .join("; ");

        // Log to the HUD inspector in the sequential solver path
        appendAiCommunicationLog({
          questionNumber: effectiveQNum,
          totalQuestions: 0,
          questionText: qData.questionText,
          options: qData.options.map((o) => o.text),
          isMultipleSelect: qData.isMultipleSelect,
          selectedIndices,
          selectedText,
          explanation: answerRes?.explanation || "",
          model: answerRes?.model || "unknown",
          latencyMs: seqLatencyMs,
          timestamp: new Date().toLocaleTimeString(),
          status: answerRes?.success ? "success" : "fallback",
        });

        await sleep(350);

        const saveBtn = findSaveButton([qData.rootDocument]);
        if (saveBtn) {
          clickElementThoroughly(saveBtn);
          await sleep(600);
          if (hasEnterResponseToast()) {
            await ensureOptionsSelected(qData.options, selectedIndices);
            clickElementThoroughly(saveBtn);
            await sleep(600);
          }
        }

        // If Save did not auto-advance, look for a separate Next button
        const nextBtns = [
          ...qData.rootDocument.querySelectorAll(
            'button, [role="button"], input[type="button"], a',
          ),
        ].filter((b) => {
          if (b === saveBtn || b.disabled || b.hasAttribute("disabled")) return false;
          const t = (b.innerText || b.textContent || b.value || "").trim().toLowerCase();
          return t === "next" || t === "next question" || t === "save & next";
        });
        if (nextBtns.length > 0) {
          clickElementThoroughly(nextBtns[0]);
        }

        answeredSet.add(effectiveQNum);
        lastHandledSig = qSig;
        questionsSolvedCount++;
        emitTelemetry("question_solved", {
          questions: 1,
          savedSeconds: 90,
          useTimeSeconds: Math.max(1, Math.round(seqLatencyMs / 1000) + 2),
          model: answerRes?.model || activeAnsweringModel || "gemini-2.5-flash",
          latencyMs: seqLatencyMs,
        });

        const changed = await waitForQuestionChange(effectiveQNum, qSig, 3500);
        if (!changed) break;
      }
    }

    log(
      `[${sectionName}] Section finished! Successfully answered ${questionsSolvedCount} questions.`,
    );
    return questionsSolvedCount;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE & EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Frame registration ────────────────────────────────────────────────────
  // The background worker uses this to route actions to the frame that owns
  // the assessment UI (important when the test is inside an iframe).
  let lastRegisteredAssessmentState = null;

  function registerFrame(force = false) {
    const hasAssessment = hasAssessmentDom();
    if (!force && lastRegisteredAssessmentState === hasAssessment) return;
    lastRegisteredAssessmentState = hasAssessment;
    try {
      chrome.runtime
        .sendMessage({
          type: "FRAME_REGISTER",
          url: window.location.href,
          hasAssessment,
        })
        .catch(() => {});
    } catch (_) {}
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.geminiModel?.newValue) {
        const nextModel = String(changes.geminiModel.newValue)
          .replace(/^models\//, "")
          .trim();
        if (nextModel) {
          activeAnsweringModel = nextModel;
          const modelEl = document.getElementById("sbHudModel");
          if (modelEl) {
            modelEl.textContent = formatModelName(nextModel);
          }
        }
      }
    });
  } catch (_) {}

  window.__SPRINGBORED_START_SOLVER__ = startAssessmentSolver;

  function maybeMountHud() {
    if (isSameOriginChildFrame()) return;
    if (hasAssessmentDom()) {
      registerFrame(true);
      if (!document.getElementById("springbored-assignment-hud")) {
        createOrUpdateHud("Ready to solve", "", false);
      }
    }
  }

  // Bind global keyboard shortcuts immediately (even before HUD is mounted)
  if (!hudShortcutsBound && !isSameOriginChildFrame()) {
    hudShortcutsBound = true;
    window.addEventListener("keydown", (e) => {
      if (
        (e.altKey && e.key.toLowerCase() === "s") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") ||
        e.key === "F2"
      ) {
        e.preventDefault();
        const hudBtn = document.getElementById("sbHudActionBtn");
        if (hudBtn) {
          hudBtn.click();
        } else if (!isRunning) {
          startAssessmentSolver(true);
        } else {
          isPaused = !isPaused;
          sendStatus({
            status: isPaused ? "paused" : "running",
            message: isPaused ? "Paused." : "Solving assessment...",
          });
        }
      }
    });
  }

  setTimeout(() => {
    registerFrame(true);
    maybeMountHud();
  }, 800);
  setTimeout(maybeMountHud, 2200);
  setTimeout(maybeMountHud, 4500);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (_sender?.id && _sender.id !== chrome.runtime.id) {
      return false;
    }
    switch (msg.action) {
      case "START":
      case "START_ASSESSMENT_SOLVER":
        registerFrame(true);
        if (!isRunning) {
          startAssessmentSolver(window === window.top);
        }
        sendResponse({ ok: true });
        return false; // Synchronous response sent
      case "PAUSE":
        if (isRunning && !isPaused) {
          isPaused = true;
          sendStatus({ status: "paused", message: "Paused." });
        }
        sendResponse({ ok: true });
        return false;
      case "RESUME":
        if (isRunning && isPaused) {
          isPaused = false;
          sendStatus({ status: "running", message: "Resumed." });
        }
        sendResponse({ ok: true });
        return false;
      case "STOP": {
        pendingStop = true;
        const wasRunning = isRunning;
        isRunning = false;
        isPaused = false;
        if (wasRunning) {
          sendStatus({ status: "stopped", message: "Stopped." });
        }
        const existingHud = document.getElementById(
          "springbored-assignment-hud",
        );
        if (existingHud) existingHud.remove();
        sendResponse({ ok: true });
        return false;
      }
      case "GET_STATUS":
        registerFrame(true);
        sendResponse({
          isRunning,
          isPaused,
          hasAssessment: hasAssessmentDom(),
        });
        return false;
      default:
        return false; // Don't keep channel open for unrecognized messages
    }
  });

  log("Assessment solver content script ready");
})();
