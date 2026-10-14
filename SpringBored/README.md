<a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Logo" style="float: ; width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 0 8px 8px;" /></a>

# ⚡ SpringBored v2.0

> **Intelligent, autonomous course automation for Infosys Springboard — fully client-side and hands-free.**

SpringBored is a lightweight Chrome Extension (Manifest V3) designed to autonomously progress through Infosys Springboard (`infyspringboard.onwingspan.com`) courses. It accelerates video lessons, marks reading and web-module materials as completed (including confirmation popups), manages module expansions, and skips all evaluations and quizzes to preserve academic integrity.

---

## ✨ Features

- 🎬 **Autonomous Video Acceleration**: Mutes and speeds up videos to **16× playback**, seeking to 3 seconds before completion so Springboard's completion beacon triggers naturally.
- 📖 **Automatic "Mark as Complete" Handling**: Detects reading materials, text lessons, and web modules, clicks the **Mark as Complete** action, and automatically confirms the modal dialog.
- ⚡ **Zero-Lag Transitions**: Smart lesson detection starts subsequent videos almost instantly without sluggish 3–5s freezes.
- 📂 **Multi-Module Navigation**: Opens the Contents tab and auto-expands nested modules/folders across module boundaries.
- 🛡️ **Assessment & Quiz Integrity**: Automatically identifies and skips all quizzes, tests, and graded assessments so you complete actual evaluations yourself.
- 🔒 **100% Client-Side & Private**: Runs entirely within your local browser. Zero credentials, tokens, or browsing history are logged or transmitted externally.
- ⚖️ **Terms of Service & Security Notice**: Dedicated one-time consent onboarding covering privacy, academic honor code compliance, and evaluation safety.
- 🎨 **Modern Dark Glassmorphic UI**: Sleek interface featuring a glowing status beacon, progress percentage bar, live activity feed, clear log button, and helpful refresh guidance.
- ⏯️ **Interactive Controls**: Start, Pause, Resume, and Stop controls directly accessible from the popup.

---

## 🚀 Installation

1. Clone or download this repository to your computer:
   ```bash
   git clone https://github.com/OjasD07/SpringBored
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer Mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the root `SpringBored` directory.
5. The **SpringBored ⚡** icon will now appear in your extensions toolbar. (Pin it for easy access!)

---

## 📖 How to Use

1. Log into Infosys Springboard: [`infyspringboard.onwingspan.com`](https://infyspringboard.onwingspan.com).
2. Open any course and enter the course player page (URL containing `/viewer/`).
3. **Tip**: Refresh the course player page once before starting so Angular mounts cleanly.
4. Click the **SpringBored** extension icon in your browser toolbar.
5. _First time only_: Review and accept the **Security & Terms of Service Notice**.
6. Click **Start** — SpringBored takes over, automatically completing lessons and advancing through modules!

> **Note**: Keep the Springboard browser tab active (not minimized) for optimal performance, as Chromium throttles timers and background tasks in hidden tabs.

---

## ⚙️ How It Works

```
                        Open Springboard Course Player
                                      ↓
                         Open Contents / TOC Tab
                                      ↓
                     Auto-Expand All Module Folders
                                      ↓
               Collect Lesson Nodes (Filter Out Quizzes & Tests)
                                      ↓
                        ┌───────────────────────────┐
                        │    For Each Lesson Item   │
                        └─────────────┬─────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
      [ Video Content ]                               [ Reading / Web Module ]
              │                                               │
   Set Muted & 16× Speed                              Click "Mark as Complete"
              │                                               │
   Seek to (Duration − 3s)                            Auto-Confirm Modal Dialog
              │                                               │
      Wait for "ended" Event                                  │
              │                                               │
   Wait 1.0s (Beacon Sent)                            Wait 1.0s (Status Saved)
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                      Click Next Navigation Button (→)
                                      │
                         Move to Next Lesson / Module
                                      ↓
                               All Done! 🎉
```

---

## 📁 Project Structure

```
SpringBored/
├── manifest.json       # Manifest V3 extension configuration
├── background.js       # Background service worker for tab messaging
├── content.js          # Core automation engine (TOC, playback, auto-confirm)
├── popup.html          # Extension popup markup (Notice + Automation Dashboard)
├── popup.css           # Modern dark-mode glassmorphic design system
├── popup.js            # Popup controller, live progress & status listeners
├── Assets/             # Visual assets
│   └── Logo.png        # Extension banner logo
└── icons/              # Browser extension icon pack
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛡️ Ethics & Academic Honor

SpringBored is created for educational convenience and workflow experimentation.

- **Assessments are never automated**: All quizzes, tests, and assessments are automatically skipped so that evaluations remain untouched for honest completion.
- Users remain solely responsible for adhering to their academic institution's honor code and learning expectations.

---

## Author

Ojas Deshpande [contact@ojasdeshpande.in]
