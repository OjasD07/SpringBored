<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# 📖 How to Use SpringBored (`v1.1.0`)

> **Complete step-by-step installation, setup, operation, and troubleshooting guide for both `SpringBored` (Course Edition) and `SpringBored - Assessment` (Assessment Edition).**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
  <a href="https://github.com/OjasD07/SpringBored/releases"><img src="https://img.shields.io/badge/Download-v1.1.0-96c99e?style=for-the-badge&labelColor=244534" alt="Download v1.1.0" /></a>
</p>

---

## 📑 Table of Contents

1. [Which Edition Should I Install?](#1-which-edition-should-i-install)
2. [Step 1 — Download & Extract](#2-step-1--download--extract)
3. [Step 2 — Load Unpacked in Chrome / Brave / Edge](#3-step-2--load-unpacked-in-chrome--brave--edge)
4. [Step 3 — Accept the First-Run Privacy & Terms Notice](#4-step-3--accept-the-first-run-privacy--terms-notice)
5. [Using SpringBored (Course Edition)](#5-using-springbored-course-edition)
6. [Using SpringBored - Assessment (Gemini AI Solver)](#6-using-springbored---assessment-gemini-ai-solver)
7. [Updating to a Newer Version](#7-updating-to-a-newer-version)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Which Edition Should I Install?

SpringBored is packaged as two independent extensions so you can install either one or both simultaneously:

- **`SpringBored` (Course Edition)**: Completes video lectures (`16×` speed + natural end-seek) and reading materials (**Mark as Complete** + confirmation dialog), and expands multi-module folders. **Skips all quizzes and assessments.** Does **not** require an API key.
- **`SpringBored - Assessment` (Assessment Edition)**: Uses **Google Gemini AI** to solve single-section quizzes, multi-section IAP assessments, and embedded Techademy assessments. Requires a free [Google AI Studio API Key](https://aistudio.google.com/app/apikey).

---

## 2. Step 1 — Download & Extract

1. Visit the official [**GitHub Releases page (`v1.1.0`)**](https://github.com/OjasD07/SpringBored/releases).
2. Download the `.zip` archive that matches your needs:
   - [**`SpringBored-Course-v1.1.0.zip`**](https://github.com/OjasD07/SpringBored/releases#release-course-v1.1.0) — Course Edition (16× Video & Reading Completer)
   - [**`SpringBored-Assessment-v1.1.0.zip`**](https://github.com/OjasD07/SpringBored/releases#release-assessment-v1.1.0) — Assessment Edition (Gemini AI Quiz & Assessment Solver)
   *(Alternatively, clone the repository with `git clone https://github.com/OjasD07/SpringBored.git`.)*
3. **Extract the `.zip` file** to a permanent folder on your computer (for example, `Documents/Extensions/SpringBored`).
   > ⚠️ **Important**: Chrome loads unpacked extensions directly from this folder. Do **not** delete or move the extracted folder while the extension is installed.

---

## 3. Step 2 — Load Unpacked in Chrome / Brave / Edge

1. Open your Chromium browser (Google Chrome, Brave, or Microsoft Edge) and navigate to:
   ```text
   chrome://extensions/
   ```
2. Turn **ON** the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the extracted extension folder that directly contains `manifest.json`:
   - Select `SpringBored` to load the Course Edition.
   - Select `SpringBored - Assessment` to load the Assessment Edition.
   *(If you downloaded the Complete Suite and want both, click **Load unpacked** twice — once for each folder.)*
5. Click the puzzle-piece icon (`🧩`) in your browser toolbar and click the **Pin** icon next to **SpringBored** so it stays visible.

> 💡 **Note on Chrome's Developer Mode Warning**: Because SpringBored is distributed via GitHub Releases rather than the Chrome Web Store, Chrome may display a banner asking whether to disable developer-mode extensions on browser startup. Simply close the banner (`×`) — do **not** click *Disable*.

---

## 4. Step 3 — Accept the First-Run Privacy & Terms Notice

On first install (or after a major terms update), the extension places a `!` badge on its toolbar icon and pauses all automation until you accept the onboarding notice:

1. Click the **SpringBored** icon in your toolbar.
2. Read the compact **Privacy & terms** summary card (covering client-side execution, academic honor code responsibility, and anonymous impact metrics).
3. Check **"I have read and agree to the Privacy & Terms"** and click **Agree & continue**.
4. The `!` badge clears immediately and the main control dashboard unlocks.

*(You can review or withdraw your consent at any time by clicking **Privacy & terms** in the popup footer.)*

---

## 5. Using SpringBored (Course Edition)

1. Sign in to [**Infosys Springboard**](https://infyspringboard.onwingspan.com/).
2. Open your target course and enter the **Course Player** (the page URL will contain `/viewer/`, such as `/en/viewer/video/...` or `/en/viewer/html/...`).
3. **Recommended**: Refresh the `/viewer/` page once (`Cmd + R` or `Ctrl + R`) so the Angular table of contents mounts cleanly.
4. Click the **SpringBored** toolbar icon and press **Run course**.
5. **What happens automatically**:
   - Opens the **Contents** tab and expands all collapsed module folders.
   - Filters out quizzes and assessments so they are skipped safely.
   - For **Video Lectures**: Mutes audio, sets playback rate to `16×`, seeks to 3 seconds before the end of the video, waits for the native `ended` event and completion beacon, and advances to the next item.
   - For **Reading / Web Modules**: Clicks **Mark as Complete** and automatically confirms the *"learning duration"* modal popup.
6. **Controls**:
   - **Pause / Resume**: Temporarily pause after the current step or resume immediately.
   - **Stop**: Halts the automation loop immediately.

> ⚠️ **Keep the Tab Visible**: Keep the Springboard browser tab active in the foreground (do not minimize the window) while running a course so Chrome does not throttle HTML5 media playback events.

---

## 6. Using SpringBored - Assessment (Gemini AI Solver)

### Part A — Configure Your Free Google Gemini API Key (One-Time Setup)
1. Open [**Google AI Studio (`aistudio.google.com/app/apikey`)**](https://aistudio.google.com/app/apikey) and sign in with your Google account.
2. Click **Create API key** and copy your key (starts with `AIzaSy...`).
3. Open the **SpringBored - Assessment** popup from your Chrome toolbar.
4. Paste your API key into the **Google Gemini API Key** input box.
5. Select your preferred model from the **Model** dropdown:
   - **Gemini 2.5 Flash (Recommended)**: Best balance of reasoning accuracy, speed, and generous free-tier rate limits.
   - **Gemini 3 Flash Preview**: Next-generation high-speed reasoning model.
   - **Gemini 2.5 Pro / Gemini 3.1 Pro Preview**: Deepest reasoning for complex code or math assessments.
   *(Note: Even if your primary model hits a `429` rate limit, SpringBored automatically falls back across the remaining Gemini models so your assessment never stalls!)*
6. Click **Save & test**. Once verified against Google's API, the key card collapses into a green **`API Key Ready`** badge (click **Change** anytime to edit).

### Part B — Solving Quizzes & Assessments
1. Open any quiz, multi-section IAP assessment, or embedded Techademy assessment on Infosys Springboard.
2. Start the solver using **any** of the following triggers:
   - **Floating Fullscreen HUD**: Click **Solve assessment** on the draggable **SpringBored** panel in the bottom-right corner of the page.
   - **Keyboard Shortcut**: Press **`Alt + S`** (or **`F2`**) anywhere on the assessment page.
   - **Toolbar Popup**: Click the extension icon in your toolbar and press **Solve assessment**.
3. **Supported Assessment Formats**:
   - **Standard Springboard Quizzes**: Reads the question stem and options, selects the verified radio button or checkboxes, clicks **Next**, and submits at the end.
   - **Multi-Section IAP Assessments**: Automatically clicks **Start** on the Instructions screen, selects **Attempt Section** / **Resume Section** on each card in the **SECTIONS** tab, solves all questions using `Save & Next` + question palette circles, returns to the sections screen, and clicks **Finish test** / **Submit** once all sections are complete.
   - **Embedded Techademy Assessments (`/viewer/html/` Iframes)**: Automatically detects cross-origin Techademy assessment iframes, delegates solving to the embedded frame while streaming live status and AI logs to the single top-window HUD, clicks **Save & Next** sequentially, and expands collapsed **Topics** in the left sidebar until every question is answered.
4. **Using the Live AI Inspector**:
   - Click **Inspector ▾** on the floating HUD to open the live telemetry drawer.
   - Every question displays the **Sent Prompt** (including extracted code blocks, Markdown tables, and subject context), the active **Gemini Model**, and the **AI Answer** (`[A]`, `[B, D]`, etc.).

---

## 7. Updating to a Newer Version

Both extensions include an automatic GitHub Releases update checker:

1. Whenever a new version is published on [**GitHub Releases**](https://github.com/OjasD07/SpringBored/releases), a gold **`NEW`** badge appears on the extension toolbar icon, and an update banner appears at the top of the popup and floating HUD.
2. You can also check manually at any time by clicking **Check updates** in the popup footer.
3. **To install an update**:
   - Click the update banner (or visit [`github.com/OjasD07/SpringBored/releases`](https://github.com/OjasD07/SpringBored/releases)) and download the new release `.zip`.
   - Extract and overwrite the files in your existing extension folder (or run `git pull` if you cloned via Git).
   - Open `chrome://extensions/` and click the **Reload (`↻`)** icon on the SpringBored extension card. Your saved API key and personal impact stats are preserved!

---

## 8. Troubleshooting & FAQ

| Issue / Symptom | Solution |
| :--- | :--- |
| **"Refresh the course player page, then try again"** | Refresh the Infosys Springboard tab (`Cmd + R` / `Ctrl + R`) once so the content script attaches cleanly to Angular's DOM. |
| **Course runner pauses or videos don't finish** | Ensure the Springboard tab is **not minimized** or hidden behind another window on the same display; Chrome throttles background media timers. |
| **`HTTP 429` or quota message during an assessment** | You don't need to stop! SpringBored automatically falls back to the next available Gemini model (`2.5 Flash` → `3 Flash` → `2.5 Pro` → `2.5 Flash Lite` → `2.0 Flash`) and retries with backoff. |
| **Floating HUD is covering a button on screen** | Drag the HUD by its top header bar (`SpringBored Assessment`) to any corner of your screen, or click the **`—`** button to collapse it into a compact pill. |
| **Assessment inside `/viewer/html/` is hosted on Techademy** | Make sure you are running `v1.1.0+` of `SpringBored - Assessment` and click **Reload (`↻`)** on `chrome://extensions/` so cross-origin iframe permissions are active. |

---

## ⭐ Star & Support My Open-Source Work

- ⭐ **Star the Repo**: [github.com/OjasD07/SpringBored](https://github.com/OjasD07/SpringBored)
- 💖 **Support My OSS (Razorpay)**: [sponsor.ojasdeshpande.in](https://sponsor.ojasdeshpande.in/)
- 🌐 **Official Website & Live Telemetry**: [springbored.ojasdeshpande.in](https://springbored.ojasdeshpande.in/)

---

## Author

**Ojas Deshpande** ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [GitHub @OjasD07](https://github.com/OjasD07) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))

---

<p align="center">
  <a href="https://springbored.ojasdeshpande.in/"><strong>SpringBored</strong></a> &copy; 2026 <a href="https://www.ojasdeshpande.in/"><strong>Ojas Shailesh Deshpande</strong></a>
</p>
