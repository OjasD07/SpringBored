// SpringBored (AI Edition) - Background Service Worker
// Manages message relay and Gemini 3.8 Flash API interactions

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SpringBored AI] Extension installed. Ready with Gemini 3.8 Flash.');
});

// Relay messages & handle Gemini AI actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATUS_UPDATE') {
    // Broadcast status to popup views
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  if (message.type === 'TEST_GEMINI_KEY') {
    testGeminiKey(message.apiKey).then(sendResponse);
    return true; // Keep async response channel open
  }

  if (message.type === 'SOLVE_QUIZ_QUESTION') {
    solveQuestionWithGemini(message.question, message.options, message.isMultipleSelect).then(sendResponse);
    return true; // Keep async response channel open
  }

  if (message.type === 'BROADCAST_START') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'START_ASSESSMENT_SOLVER' }).catch(() => {});
      }
    });
    return false;
  }

  return false;
});

// Prioritized Gemini Models (Official Google Gemini API endpoints)
const PREFERRED_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro'
];

/** Fetch the list of models supported by this user's API key */
async function getAvailableModelsForKey(apiKey) {
  const versions = ['v1beta', 'v1'];
  for (const ver of versions) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        const available = (data?.models || [])
          .filter(m => (m.supportedGenerationMethods || m.supportedActions || []).includes('generateContent'))
          .map(m => ({
            name: m.name.replace(/^models\//, ''),
            displayName: m.displayName || m.name,
            version: ver
          }));

        if (available.length > 0) return available;
      }
    } catch (_) {}
  }
  return [];
}

/** Test Gemini API Key and confirm true Gemini model support */
async function testGeminiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return { success: false, error: 'API key is too short or empty' };
  }

  const cleanKey = apiKey.trim();

  // 1. Check available models dynamically from Google for this key
  const availableList = await getAvailableModelsForKey(cleanKey);
  // Strictly filter for official Gemini models only — exclude Gemma completely!
  const geminiAvailable = availableList
    .map(m => m.name)
    .filter(name => name.toLowerCase().startsWith('gemini'));

  // 2. Build candidate list prioritizing high-speed flagship Gemini models
  const candidateModels = [];
  for (const m of PREFERRED_MODELS) {
    if (geminiAvailable.length === 0 || geminiAvailable.includes(m)) {
      candidateModels.push(m);
    }
  }
  for (const name of geminiAvailable) {
    if (!candidateModels.includes(name)) candidateModels.push(name);
  }

  let lastError = 'Failed to connect to Gemini API';

  // 3. Test generation with candidate models
  for (const model of candidateModels) {
    const apiVersions = ['v1beta', 'v1'];
    for (const ver of apiVersions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${cleanKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with JSON: {"status":"ok"}' }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (res.ok) {
          return { success: true, model, apiVersion: ver };
        } else {
          const errData = await res.json().catch(() => ({}));
          lastError = errData?.error?.message || `HTTP ${res.status}`;
        }
      } catch (e) {
        lastError = e.message || 'Network error';
      }
    }
  }

  return { success: false, error: lastError };
}

/** Robust JSON parser handling raw JSON, markdown fences, and embedded blocks */
function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {}

  // Strip code block fences ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch (_) {}
  }

  // Match outermost curly braces
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {}
  }

  return null;
}

/** Solve Quiz Question using Gemini 3.8 Flash */
async function solveQuestionWithGemini(questionText, options, isMultipleSelect) {
  const { geminiApiKey, geminiModel, geminiApiVersion } = await chrome.storage.local.get([
    'geminiApiKey',
    'geminiModel',
    'geminiApiVersion'
  ]);

  if (!geminiApiKey) {
    return { success: false, error: 'No Gemini API key configured in extension settings' };
  }

  const cleanKey = geminiApiKey.trim();
  const optionsFormatted = options.map((opt, idx) => `[${idx}]: ${opt}`).join('\n');

  const prompt = `You are an expert test taker. You are answering a question from a course on Infosys Springboard.

Question:
"${questionText}"

Options:
${optionsFormatted}

Question Type: ${isMultipleSelect ? 'Multiple choices allowed (select all correct options)' : 'Single choice (exactly one option is correct)'}

Instructions:
1. Identify the objectively correct option(s).
2. Respond ONLY with a valid JSON object matching this schema:
{
  "selected_indices": [0],
  "explanation": "Brief explanation why this option is correct"
}

Remember: "selected_indices" MUST be an array of 0-based integer indices corresponding to the options above.`;

  // Strictly use official Gemini models — ignore any saved non-Gemini models
  const cleanModel = (geminiModel && geminiModel.toLowerCase().startsWith('gemini')) ? geminiModel : 'gemini-2.0-flash';
  const modelsToTry = [
    cleanModel,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro'
  ].filter((v, i, a) => a.indexOf(v) === i);

  const ver = geminiApiVersion || 'v1beta';
  let lastError = 'Failed to generate solution';

  for (const model of modelsToTry) {
    for (const apiVer of [ver, ver === 'v1beta' ? 'v1' : 'v1beta']) {
      try {
        const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${cleanKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          lastError = errData?.error?.message || `HTTP ${res.status}`;
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const parsed = parseJsonSafe(rawText);
        if (parsed && Array.isArray(parsed.selected_indices) && parsed.selected_indices.length > 0) {
          return {
            success: true,
            selected_indices: parsed.selected_indices,
            explanation: parsed.explanation || '',
            model
          };
        }
      } catch (e) {
        lastError = e.message || 'JSON parse error';
      }
    }
  }

  return { success: false, error: lastError };
}
