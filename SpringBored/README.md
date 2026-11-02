<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# ⚡ SpringBored — Course Edition (`v1.0.0`)

> **Autonomous 16× video accelerator, reading completer, and multi-module course runner for Infosys Springboard (`infyspringboard.onwingspan.com`) — zero API keys required.**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
  <a href="https://github.com/OjasD07/SpringBored/releases/latest"><img src="https://img.shields.io/badge/Release-v1.0.0-96c99e?style=for-the-badge&labelColor=244534" alt="Release v1.0.0" /></a>
  <a href="https://springbored.ojasdeshpande.in/"><img src="https://img.shields.io/badge/Website-springbored.ojasdeshpande.in-f3ebd3?style=for-the-badge&labelColor=244534" alt="Official Website" /></a>
</p>

**SpringBored (Course Edition)** is a lightweight Manifest V3 Chrome extension designed to autonomously progress through **Infosys Springboard** (`infyspringboard.onwingspan.com`) courses. It accelerates video lessons to `16×`, marks reading and web-module materials as completed (including confirmation dialogs), expands multi-module table-of-contents trees, and **automatically skips all quizzes and graded assessments**.

---

## ✨ Features

- 🎬 **Autonomous 16× Video Acceleration**: Mutes and speeds up HTML5 video lectures to **16× playback**, seeking to `duration − 3s` so Springboard's native `ended` event and completion beacon trigger naturally.
- 📖 **Automatic "Mark as Complete" & Modal Handling**: Detects reading materials, PDFs, text lessons, and web modules, clicks **Mark as Complete**, and automatically confirms the *"learning duration"* modal dialog (`Yes` / `Confirm` / `OK`).
- 📂 **Multi-Module TOC Expansion**: Opens the course **Contents** drawer and recursively expands collapsed module and folder accordions across module boundaries.
- ⚡ **Zero-Lag Lesson Transitions**: Smart polling and DOM readiness detection start subsequent videos and reading modules without sluggish multi-second stalls.
- 🛡️ **Strict Quiz & Assessment Bypass**: Automatically identifies and skips quizzes, tests, and assessments so graded evaluations remain untouched.
- 📊 **Personal Impact Strip**: Displays your cumulative **Lectures**, **Modules**, and **Time Saved** directly inside the extension popup.
- 🔔 **GitHub Releases Update Nudge**: Automatically checks [`OjasD07/SpringBored/releases`](https://github.com/OjasD07/SpringBored/releases) and displays a `NEW` badge + one-click update banner when a newer release is published.
- 🌿 **Botanical Forest UI & Controls**: Features a clean forest-green and warm-cream interface with **Run course**, **Pause**, **Resume**, and **Stop** controls, a live progress bar, and an activity log.

---

## 🚀 Installation

1. Download **`SpringBored-Course-v1.0.0.zip`** (or `SpringBored-Complete-Suite-v1.0.0.zip`) from [**GitHub Releases**](https://github.com/OjasD07/SpringBored/releases/latest) and extract it to a permanent folder, **or** clone the repository:
   ```bash
   git clone https://github.com/OjasD07/SpringBored.git
   ```
2. Open Google Chrome (or Brave / Edge) and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the `SpringBored` folder (the directory containing `manifest.json`).
5. Pin the **SpringBored** icon to your browser toolbar for one-click access.

---

## 📖 How to Use

1. Sign in to Infosys Springboard: [`infyspringboard.onwingspan.com`](https://infyspringboard.onwingspan.com/).
2. Open any course and enter the course player page (URL containing `/viewer/`).
3. **Tip**: Refresh the course player page once (`Cmd + R` / `Ctrl + R`) before starting so Angular mounts the TOC cleanly.
4. Click the **SpringBored** extension icon in your toolbar.
5. *First time only*: Review and accept the compact **Privacy & terms** agreement card.
6. Click **Run course** — SpringBored takes over, completing video lectures and reading materials and advancing through modules automatically.

> **Important**: Keep the Springboard tab active in the foreground (not minimized) while running, as Chromium throttles timers and media events in background tabs.

---

## ⚙️ How It Works

```text
                        Open Springboard Course Player (/viewer/)
                                           ↓
                              Open Contents / TOC Drawer
                                           ↓
                          Auto-Expand All Module Accordions
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
          Wait for "ended" Event                                   │
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
                                    Course Complete! 🎉
```

---

## 🔐 Permissions & Storage

### Browser Permissions (`manifest.json`)

| Permission | Purpose |
| :--- | :--- |
| `storage` | Persist consent state, local impact stats (`Lectures`, `Modules`, `Time Saved`), and update-check cache in `chrome.storage.local`. |
| `activeTab` | Communicate with the active Springboard course tab when **Run course** is clicked. |
| `scripting` | Dynamically inject `content.js` into an already-open `/viewer/` tab if the extension was just installed or reloaded. |
| `https://infyspringboard.onwingspan.com/*` | Run the course automation content script on Infosys Springboard pages. |
| `https://springbored.ojasdeshpande.in/*` | Check `/api/version` for release updates and send anonymous aggregate completion deltas to `/api/telemetry`. |
| `https://api.github.com/*` | Fallback check against `repos/OjasD07/SpringBored/releases/latest` for version update notifications. |

### Local Storage Keys (`chrome.storage.local`)

- `sbConsent`: `{ accepted: boolean, version: "1.0.0", acceptedAt: number }` — gates all automation until the current terms version is accepted.
- `sbLocalStats`: `{ lecturesCompleted, modulesCompleted, coursesCompleted, activeSeconds, savedSeconds }` — powers the popup impact stats strip.
- `sbInstallId`: Randomly generated anonymous UUID used strictly for aggregate telemetry deduplication.
- `sbUpdateInfo`: Cached latest release metadata from GitHub Releases (`latestVersion`, `hasUpdate`, `releaseUrl`).

---

## 📁 Project Structure

```text
SpringBored/
├── manifest.json       # Manifest V3 extension configuration (v1.0.0)
├── background.js       # Service worker: consent badge, telemetry & GitHub update checker
├── content.js          # Core automation engine (TOC, 16x video playback, auto-confirm)
├── popup.html          # Extension popup UI (Consent Gate + Course Runner Dashboard)
├── popup.css           # Botanical forest design system (#244534, #f3ebd3, #e5a952)
├── popup.js            # Popup controller, live progress, personal stats & update banner
├── Assets/
│   └── Logo.png        # SpringBored botanical forest emblem (512x512)
└── icons/              # Browser toolbar icons (16x16, 48x48, 128x128)
```

---

## 🛡️ Ethics & Academic Honor

- **Assessments Are Never Automated**: All quizzes, tests, and graded assessments are automatically skipped by Course Edition.
- Users remain solely responsible for adhering to their institution's honor code and platform terms of service. See [../DISCLAIMER.md](../DISCLAIMER.md) and [../PRIVACY.md](../PRIVACY.md).

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
