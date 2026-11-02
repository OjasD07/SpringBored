<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# ⚡ SpringBored — Assessment Edition (`v1.0.0`)

> **Autonomous Quiz, Test & Multi-Section Assessment Solver for Infosys Springboard (`infyspringboard.onwingspan.com`), IAP, and Techademy — powered by Google Gemini 2.5 & 3 AI.**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
  <a href="https://github.com/OjasD07/SpringBored/releases/latest"><img src="https://img.shields.io/badge/Release-v1.0.0-96c99e?style=for-the-badge&labelColor=244534" alt="Release v1.0.0" /></a>
  <a href="https://springbored.ojasdeshpande.in/"><img src="https://img.shields.io/badge/Website-springbored.ojasdeshpande.in-f3ebd3?style=for-the-badge&labelColor=244534" alt="Official Website" /></a>
</p>

**SpringBored (Assessment Edition)** is a high-precision Manifest V3 Chrome extension dedicated exclusively to solving single-section quizzes, multi-section IAP assessments, and embedded cross-origin Techademy assessments on **Infosys Springboard** (`infyspringboard.onwingspan.com`).

**Supports all academic and technical domains** — Python, Java, C/C++, JavaScript/TypeScript, SQL, Data Structures, Cloud, Finance, Management, Mathematics, and General Aptitude.

---

## ✨ Features

### 🧠 High-Accuracy Gemini AI Pipeline
- **Multi-Model Fallback Chain**: Defaults to `gemini-2.5-flash` (best speed + accuracy on the free tier) and automatically falls back through:
  1. `gemini-2.5-flash`
  2. `gemini-3-flash-preview`
  3. `gemini-2.5-pro`
  4. `gemini-3.1-pro-preview`
  5. `gemini-2.5-flash-lite`
  6. `gemini-2.0-flash`
  7. Dynamic `/v1beta/models` discovery
  whenever a model is rate-limited (`429`) or temporarily overloaded (`503`).
- **Thinking Budgets**: Allocates native Gemini `thinkingConfig.thinkingBudget` (`4096` tokens on Pro models, `2048` tokens on Flash 2.5/3 models) with `temperature: 0.0` for deterministic step-by-step reasoning.
- **Two-Pass Self-Verification Critic**: Automatically triggers a second verification pass on multi-select (`checkbox`) questions, code-tracing problems, numerical/table calculations, and negation questions (`NOT`, `EXCEPT`, `FALSE`, `INCORRECT`).
- **Subject Context Awareness**: Extracts the active course, assessment, and section/topic title from the page and injects it into the system prompt to disambiguate domain-specific terminology.

### 🔍 Structure-Preserving DOM & Multimodal Scraper
- **Code & Indentation Preservation**: Extracts `<pre>`, `<code>`, Ace Editor (`.ace_line`), Monaco (`.view-line`), and CodeMirror (`.cm-line`) blocks with exact newline and whitespace indentation intact (critical for Python questions).
- **Markdown Table Reconstruction**: Converts HTML `<table>` rows and cells into clean pipe-delimited Markdown tables (`| Col A | Col B |`) so tabular data stays aligned.
- **MathJax, KaTeX & Exponent Extraction**: Reads `<annotation encoding="application/x-tex">`, `data-latex`, `aria-label`, and converts `<sup>`/`<sub>` into `^{...}` / `_{...}` notation so `10^6` never collapses into `106`.
- **Multimodal Vision Support**: Captures inline question diagrams (`<img>` and `<canvas>`) as base64 `inlineData` payloads and sends them alongside the text prompt to Gemini Vision.

### 📑 Universal Assessment Navigation (Standard, IAP & Techademy)
- **Standard Springboard Quizzes**: Solves questions 1 to N, clicks `Next` / `Submit`, and confirms completion dialogs.
- **Multi-Section IAP Assessments**: Clicks **Start** on the Instructions screen, iterates through all cards on the **SECTIONS** tab (**Attempt Section** / **Resume Section**), traverses the question palette, returns to sections when finished, and submits the completed test.
- **Cross-Origin Techademy Assessments (`all_frames: true`)**: Works seamlessly when Springboard `/viewer/html/` embeds external assessment iframes (`*.techademy.com`, `*.techademyone.com`, `*.yaksha.com`, `*.iiht.com`). The top frame delegates solving to the child assessment iframe while acting as the unified display HUD, advancing sequentially via **Save & Next** and expanding collapsed **Topics** accordions automatically.

### 🪟 Floating Fullscreen HUD (`Alt + S`)
- **Draggable Corner Overlay**: Stays visible and interactive even inside `100%` fullscreen exam modes.
- **Live AI Inspector**: Expand the **Inspector** drawer to watch every question stem, option list, model name, and chosen answer `[A, C]` in real time.
- **Keyboard Shortcuts**: Toggle solving anytime with **`Alt + S`** or **`F2`**.

---

## 🔑 Getting Your Free Gemini API Key

1. Visit [**Google AI Studio**](https://aistudio.google.com/app/apikey) and sign in with your Google account.
2. Click **Create API key** and copy the generated key (starts with `AIzaSy...`).
3. Click the **SpringBored - Assessment** icon in your Chrome toolbar.
4. Accept the one-time **Privacy & terms** notice, paste your key into the **Google Gemini API Key** field, choose your preferred model (`Gemini 2.5 Flash (Recommended)`), and click **Save & test**.
5. Once validated, the key panel collapses into a compact `API Key Ready` pill.

---

## 🚀 Installation

1. Download **`SpringBored-Assessment-v1.0.0.zip`** (or `SpringBored-Complete-Suite-v1.0.0.zip`) from [**GitHub Releases**](https://github.com/OjasD07/SpringBored/releases/latest) and extract it to a permanent folder, **or** clone the repository:
   ```bash
   git clone https://github.com/OjasD07/SpringBored.git
   ```
2. Open Google Chrome (or Brave / Edge) and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `SpringBored - Assessment` folder (the directory containing `manifest.json`).
5. Pin the **SpringBored** icon to your toolbar.

---

## 📖 How to Use

1. Open your target quiz or assessment on Infosys Springboard (`infyspringboard.onwingspan.com`).
2. Trigger the solver using any of three methods:
   - Click **Solve assessment** on the floating **SpringBored** HUD in the bottom-right corner.
   - Press **`Alt + S`** (or **`F2`**) on your keyboard.
   - Open the toolbar popup and click **Solve assessment**.
3. SpringBored will automatically start the assessment, read each question and option, query Gemini, select the verified option(s), click **Save & Next**, traverse all sections/topics, and submit the test when complete.
4. Need to pause or stop? Click **Stop** on the HUD, press **`Alt + S`** again, or click **Stop** in the popup.

---

## 🔐 Permissions & Security Architecture

| Permission | Purpose |
| :--- | :--- |
| `storage` | Store your Gemini API key, selected model, consent state, and local stats (`Questions`, `Assessments`, `Time Saved`) in `chrome.storage.local`. |
| `activeTab` | Dispatch **Solve assessment** / **Stop** commands to the active tab and its assessment frames. |
| `scripting` | Dynamically inject `content.js` into all frames (`allFrames: true`) when triggered from the popup or background worker. |
| `https://infyspringboard.onwingspan.com/*`, `https://*.onwingspan.com/*` | Run on Infosys Springboard viewer and assessment pages. |
| `https://*.techademy.com/*`, `https://*.techademyone.com/*`, `https://*.yaksha.com/*`, `https://*.iiht.com/*`, `https://*/*` | Allow `content.js` (`all_frames: true`) to run inside cross-origin embedded assessment iframes. A strict top-frame domain guard in `content.js` immediately exits on non-Springboard top-level websites. |
| `https://generativelanguage.googleapis.com/*` | Communicate directly with Google's official Gemini API endpoint. |
| `https://springbored.ojasdeshpande.in/*`, `https://api.github.com/*` | Check for new GitHub Releases (`GET /api/version`) and report anonymous aggregate solve counts (`POST /api/telemetry`). |

### Security Guarantees
- **Header-Only API Key Transport**: Your Gemini API key is sent strictly via the `x-goog-api-key` HTTP header — never in URL query strings.
- **Prompt-Injection Sanitization**: Untrusted DOM text is sanitized (`sanitizeText`) and wrapped in strict boundary delimiters before prompt assembly.
- **Sender Verification**: Background runtime listeners verify `sender.id === chrome.runtime.id` before processing messages.

---

## 📁 Project Structure

```text
SpringBored - Assessment/
├── manifest.json       # Manifest V3 configuration with all_frames iframe support (v1.0.0)
├── background.js       # Gemini API solver, fallback chain, critic pass, cross-frame broadcaster
├── content.js          # DOM/code/table/diagram scraper, IAP/Techademy navigator, HUD & relay
├── popup.html          # Extension popup UI (Consent Gate + Gemini Engine + Solver Controls)
├── popup.css           # Botanical forest design system (#244534, #f3ebd3, #e5a952)
├── popup.js            # Popup controller, API key validator, model selector & update banner
├── Assets/
│   └── Logo.png        # SpringBored botanical forest emblem (512x512)
└── icons/              # Browser toolbar icons (16x16, 48x48, 128x128)
```

---

## ⭐ Star & Support My Open-Source Work

- ⭐ **Star the Repo**: [github.com/OjasD07/SpringBored](https://github.com/OjasD07/SpringBored)
- 💖 **Support My OSS (Razorpay)**: [sponsor.ojasdeshpande.in](https://sponsor.ojasdeshpande.in/)
- 🌐 **Official Website & Live Telemetry**: [springbored.ojasdeshpande.in](https://springbored.ojasdeshpande.in/)

---

## Author

**Ojas Shailesh Deshpande** ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [GitHub @OjasD07](https://github.com/OjasD07) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))

---

<p align="center">
  <a href="https://springbored.ojasdeshpande.in/"><strong>SpringBored</strong></a> &copy; 2026 <a href="https://www.ojasdeshpande.in/"><strong>Ojas Shailesh Deshpande</strong></a>
</p>
