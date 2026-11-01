<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 8px 8px 0; vertical-align: middle;" /></a>
  <a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 8px; vertical-align: middle;" /></a>
</p>

# ⚡ SpringBored (Assessment Edition) v1.0.0

> **Autonomous Quiz, Test & Multi-Section Assessment Solver for Infosys Springboard — powered by Google Gemini AI with dynamic model selection.**

SpringBored Assessment Edition is a focused, high-precision Chrome Extension (Manifest V3) dedicated exclusively to attempting and solving quizzes, tests, and multi-section assessments (IAP) on Infosys Springboard (`infyspringboard.onwingspan.com`).

**Supports all subjects** — Computer Science, Management, Finance, General Knowledge, Science, and any other academic or professional domain.

---

## ✨ Features

- 🤖 **Dynamic Gemini AI Intelligence**:
  - Supports Google's full range of Gemini models — select your preferred model from the built-in dropdown.
  - Built-in model selector allowing you to switch models on the fly.
  - Understands question stems, code snippets (HTML, CSS, JS, Python, Java, SQL), textual questions, and multi-line options across all subjects.
  - Supports both single-choice radio buttons (`input[type="radio"]`, `mat-radio-button`, custom styled options) and multiple-choice checkboxes.
- 📑 **Full Multi-Section Assessment (IAP) Support**:
  - Detects and clicks **Start** on the Instructions screen.
  - Identifies all section cards on the **SECTIONS** tab and automatically clicks **Attempt Section** / **Resume Section**.
  - Solves questions 1 through N, saves answers, and advances automatically.
  - Fallback palette navigation: uses left question palette circles (1–25) to advance smoothly if standard navigation pauses.
  - Returns back to the sections screen after each section completes and automatically proceeds to the next section.
  - Automatically clicks **Finish test** / **Submit** and confirms the submission dialog when all sections are complete.
- 🪟 **Floating Fullscreen HUD**:
  - Seamlessly hovers in the corner, remaining interactive even in 100% fullscreen or iframe assessment modes.
  - Live AI Communication Inspector — see every question sent to Gemini and the response received in real-time.
  - Allows triggering the solver with a single click or keyboard shortcut (**Alt + S** or **F2**).
- 🔒 **Security Hardened & Private**:
  - Your Gemini API key is stored strictly inside local browser storage (`chrome.storage.local`).
  - API key transmitted via secure HTTP headers (never in URL query parameters).
  - Content Security Policy (CSP) enforced on popup.
  - Extension only runs on Infosys Springboard domains — no injection into other websites.
  - Input sanitization prevents prompt injection from untrusted page content.
  - No intermediate servers or telemetry; direct communication with Google's API.

---

## 🔑 Getting Your Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **Create API Key**.
4. Copy your API key (starts with `AIzaSy...`).
5. Open the SpringBored Assessment extension popup, paste the key into the API key field, and click **Save & test**.

---

## 🚀 Installation

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer Mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the `SpringBored - Assessment` folder.
4. Pin the **SpringBored** icon to your toolbar.

---

## 📖 How to Use

1. Log into Infosys Springboard and open your target assessment or quiz.
2. If taking a full-window or fullscreen assessment, look for the **SpringBored** HUD in the corner.
3. Click **Solve assessment** on the HUD or press **Alt + S**.
4. Alternatively, click the extension icon in your browser toolbar and click **Solve assessment**.
5. SpringBored will automatically start the test, attempt each section, solve each question with your selected Gemini model, save your answers, and submit the assessment!

---

## 🔒 Security

- API keys never appear in URLs — transmitted exclusively via HTTP headers.
- Extension permissions restricted to Infosys Springboard domains only.
- Content Security Policy prevents unauthorized script/resource loading.
- Prompt injection defense via input sanitization and boundary delimiters.
- No data collection, no telemetry, no external servers.
