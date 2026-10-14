<a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Logo" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 0 8px 8px;" /></a>

# ⚡ SpringBored (Assignment Edition) v2.2

> **Autonomous Quiz, Test & Multi-Section Assessment Solver for Infosys Springboard — powered by Google Gemini 3.8 Flash.**

SpringBored Assignment Edition is a focused, high-precision Chrome Extension (Manifest V3) dedicated exclusively to attempting and solving quizzes, tests, and multi-section assessments (IAP) on Infosys Springboard (`infyspringboard.onwingspan.com`).

---

## ✨ Features

- 🤖 **Gemini 3.8 Flash Intelligence**:
  - Connects to Google's state-of-the-art **Gemini 3.8 Flash** (`gemini-3.8-flash`) model via structured JSON schema inference.
  - Understands question stems, code snippets (HTML, CSS, JS, Python, Java, SQL), and multi-line options.
  - Supports both single-choice radio buttons (`input[type="radio"]`, `mat-radio-button`, custom styled options) and multiple-choice checkboxes.
- 📑 **Full Multi-Section Assessment (IAP) Support**:
  - Detects and clicks **Start** on the Instructions screen.
  - Identifies all section cards on the **SECTIONS** tab and automatically clicks **Attempt Section** / **Resume Section**.
  - Solves questions 1 through N, saves answers, and advances automatically.
  - Fallback palette navigation: uses left question palette circles (1–25) to advance smoothly if standard navigation pauses.
  - Returns back to the sections screen after each section completes and automatically proceeds to the next section.
  - Automatically clicks **Finish test** / **Submit** and confirms the submission dialog when all sections are complete.
- 🪟 **Floating Fullscreen HUD**:
  - Seamlessly hovers in the top-right corner, remaining interactive even in 100% fullscreen or iframe assessment modes.
  - Allows triggering the solver with a single click or keyboard shortcut (**Alt + S** or **F2**).
- 🔒 **Client-Side & Private**:
  - Your Gemini API key is stored strictly inside local browser storage (`chrome.storage.local`).
  - No intermediate servers or telemetry; direct communication with Google's API.

---

## 🔑 Getting Your Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **Create API Key**.
4. Copy your API key (starts with `AIzaSy...`).
5. Open the SpringBored Assignment extension popup, paste the key into the API key field, and click **Save & Test**.

---

## 🚀 Installation

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer Mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the `SpringBored - Assignment` folder.
4. Pin the **SpringBored** icon to your toolbar.

---

## 📖 How to Use

1. Log into Infosys Springboard and open your target assessment or quiz.
2. If taking a full-window or fullscreen assessment, look for the purple **SpringBored AI** HUD in the top-right corner.
3. Click **⚡ Auto-Solve Assessment Now** on the HUD or press **Alt + S**.
4. Alternatively, click the extension icon in your browser toolbar and click **Solve Assessment Now**.
5. SpringBored will automatically start the test, attempt each section, solve each question with Gemini 3.8 Flash, save your answers, and submit the assessment!
