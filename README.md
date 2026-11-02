<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# ⚡ SpringBored (`v1.0.0`)

> **Intelligent, autonomous course & assessment automation suite for Infosys Springboard (`infyspringboard.onwingspan.com`) — built as two zero-dependency Manifest V3 Chrome extensions.**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo on GitHub" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
  <a href="https://github.com/OjasD07/SpringBored/releases/latest"><img src="https://img.shields.io/badge/Release-v1.0.0-96c99e?style=for-the-badge&labelColor=244534" alt="Release v1.0.0" /></a>
  <a href="https://springbored.ojasdeshpande.in/"><img src="https://img.shields.io/badge/Website-springbored.ojasdeshpande.in-f3ebd3?style=for-the-badge&labelColor=244534" alt="Official Website" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-84987c?style=for-the-badge&labelColor=244534" alt="Apache 2.0 License" /></a>
</p>

---

## 🌿 Overview

**SpringBored** is an open-source browser automation suite engineered specifically for the **Infosys Springboard** (`infyspringboard.onwingspan.com`) learning platform and its embedded assessment engines (**IAP** and **Techademy**).

To keep course completion separate from graded evaluations, SpringBored is split into **two standalone Chrome extensions**:

| Edition | Directory | Purpose & Capabilities | AI Engine |
| :--- | :--- | :--- | :---: |
| [**SpringBored (Course Edition)**](./SpringBored/README.md) | [`SpringBored/`](./SpringBored) | **16× Course Completer**: Mutes and accelerates video lectures to `16×`, seeks to `duration − 3s` so completion beacons fire naturally, clicks **Mark as Complete** on reading modules, dismisses duration confirmation modals, and expands nested module trees. **Deliberately skips all quizzes and assessments.** | ❌ None required |
| [**SpringBored (Assessment Edition)**](./SpringBored%20-%20Assessment/README.md) | [`SpringBored - Assessment/`](./SpringBored%20-%20Assessment) | **Autonomous AI Assessment & Quiz Solver**: Powered by **Google Gemini 2.5 & 3** with thinking budgets and a two-pass self-critic verifier. Solves standard Springboard quizzes, multi-section IAP assessments, and cross-origin Techademy assessments (`all_frames`). Includes a draggable fullscreen HUD (`Alt + S`) with a live AI prompt/response inspector. | ✅ Google Gemini API (Free Tier Supported) |

🌐 **Official Website & Live Telemetry Dashboard**: [**springbored.ojasdeshpande.in**](https://springbored.ojasdeshpande.in/)

---

## ✨ Key Highlights

### 🎬 Course Edition (`SpringBored/`)
- **16× Video Playback & Natural Beacon Triggering**: Accelerates HTML5 video lectures to `16×` and seeks to 3 seconds before the end so Springboard's native `ended` event and completion telemetry fire cleanly.
- **Reading & Web-Module Completion**: Automatically triggers **Mark as Complete** on PDF/reading/web pages and confirms the *"learning duration"* modal dialog.
- **Multi-Module TOC Traversal**: Opens the course **Contents** drawer, expands collapsed module/folder accordions, and progresses sequentially across module boundaries.
- **Strict Evaluation Bypass**: Detects quizzes, tests, and assessments in the table of contents or viewer URL and skips them automatically.

### 🧠 Assessment Edition (`SpringBored - Assessment/`)
- **Multi-Model Gemini Fallback Chain**: Defaults to `gemini-2.5-flash` and automatically falls back through `gemini-3-flash-preview` → `gemini-2.5-pro` → `gemini-3.1-pro-preview` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` → dynamically discovered `/models` if rate-limited (`429`) or overloaded (`503`).
- **Thinking Budget + Two-Pass Self-Critic**: Allocates native Gemini `thinkingBudget` (`4096` tokens on Pro, `2048` tokens on Flash) and runs a second verification pass on complex multi-choice, code, math, and negation questions.
- **High-Fidelity DOM & Multimodal Scraper**: Preserves Python/Java/C++/SQL indentation, converts HTML `<table>` grids into Markdown tables, extracts MathJax/KaTeX/MathML annotations and `<sub>`/`<sup>` exponents, and attaches inline question diagrams (`<img>` / `<canvas>`) as multimodal vision inputs.
- **Standard, IAP & Cross-Origin Techademy Support**: Navigates instructions screens, multi-section IAP `SECTIONS` tabs, Techademy topic accordions, question palettes, `Save & Next` flows, and final submission modals — including assessments hosted inside cross-origin iframes (`*.techademy.com`, `*.techademyone.com`, `*.yaksha.com`, `*.iiht.com`).
- **Floating Fullscreen HUD (`Alt + S`)**: Draggable in-page overlay that stays accessible in fullscreen exams, complete with a **Live AI Inspector** showing the exact prompt sent and answer received for every question.

### 🔔 Built-in Update Nudge & Personal Impact Stats
- **GitHub Releases Update Checker**: Both extensions periodically check [`OjasD07/SpringBored/releases`](https://github.com/OjasD07/SpringBored/releases) (or on-demand via **Check updates** in the popup footer) and display a `NEW` toolbar badge + update banner when a newer version is available.
- **Personal Impact Strip**: Tracks your local lectures/modules/courses completed or questions/assessments solved right inside the extension popup.

---

## 📦 Installation (GitHub Releases)

All official builds are distributed via [**GitHub Releases**](https://github.com/OjasD07/SpringBored/releases/latest). Because Chrome cannot load a `.zip` file directly in Developer Mode, extract the archive first:

1. Download the latest release archive from [**GitHub Releases (`v1.0.0`)**](https://github.com/OjasD07/SpringBored/releases/latest):
   - `SpringBored-Course-v1.0.0.zip` *(Course Edition only)*
   - `SpringBored-Assessment-v1.0.0.zip` *(Assessment Edition only)*
   - `SpringBored-Complete-Suite-v1.0.0.zip` *(Both extensions)*
   - Or clone the repository:
     ```bash
     git clone https://github.com/OjasD07/SpringBored.git
     ```
2. Extract the `.zip` archive to a permanent folder on your computer (do not delete the folder while the extension is installed).
3. Open Google Chrome (or Brave / Edge) and navigate to:
   ```text
   chrome://extensions/
   ```
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked** (top-left) and select either:
   - the `SpringBored` folder *(for Course Edition)*, or
   - the `SpringBored - Assessment` folder *(for Assessment Edition)*.
6. Pin the **SpringBored** icon from the Chrome extensions puzzle menu (`🧩`) to your toolbar.

---

## 🚀 Quick Start

### Using Course Edition (`SpringBored/`)
1. Sign in to [Infosys Springboard (`infyspringboard.onwingspan.com`)](https://infyspringboard.onwingspan.com/) and open any course player (`/viewer/`).
2. Click the **SpringBored** toolbar icon and accept the one-time **Privacy & Terms** agreement.
3. Click **Run course**. Keep the tab open in the foreground while SpringBored completes lectures and reading modules automatically.

### Using Assessment Edition (`SpringBored - Assessment/`)
1. Generate a free Gemini API key from [**Google AI Studio**](https://aistudio.google.com/app/apikey).
2. Click the **SpringBored - Assessment** toolbar icon, accept the one-time **Privacy & Terms** agreement, paste your `AIzaSy...` key, select your preferred Gemini model (`Gemini 2.5 Flash` recommended), and click **Save & test**.
3. Open any Springboard quiz, multi-section IAP assessment, or Techademy assessment.
4. Click **Solve assessment** in the floating corner HUD, press **`Alt + S`** (or **`F2`**), or click **Solve assessment** in the extension popup.

👉 For detailed walkthroughs, keyboard shortcuts, and troubleshooting, read [**How_To_Use.md**](./How_To_Use.md).

---

## 📁 Repository Structure

```text
SpringBored/
├── .github/
│   ├── FUNDING.yml                  # GitHub Sponsors & Razorpay OSS funding links
│   ├── ISSUE_TEMPLATE/              # Bug report & feature request templates
│   └── PULL_REQUEST_TEMPLATE.md     # Pull request checklist template
├── SpringBored/                     # Course Edition (16x video & reading completer)
│   ├── Assets/
│   │   └── Logo.png                 # Botanical forest brand emblem (512x512)
│   ├── icons/                       # Extension toolbar icons (16px, 48px, 128px)
│   ├── manifest.json                # Manifest V3 configuration (v1.0.0)
│   ├── background.js                # Service worker, consent badge, telemetry & update checker
│   ├── content.js                   # TOC expander, 16x video seeker, reading & modal handler
│   ├── popup.html                   # Popup UI (consent gate, controls, stats, update banner)
│   ├── popup.css                    # Botanical forest design system stylesheet
│   ├── popup.js                     # Popup controller & live status synchronization
│   └── README.md                    # Course Edition documentation
├── SpringBored - Assessment/        # Assessment Edition (Autonomous Gemini AI solver)
│   ├── Assets/
│   │   └── Logo.png                 # Botanical forest brand emblem (512x512)
│   ├── icons/                       # Extension toolbar icons (16px, 48px, 128px)
│   ├── manifest.json                # Manifest V3 configuration with all_frames iframe support
│   ├── background.js                # Gemini API client, fallback chain, critic pass & telemetry
│   ├── content.js                   # DOM/table/code/diagram scraper, HUD & cross-frame relay
│   ├── popup.html                   # Popup UI (API key setup, model selector, stats & controls)
│   ├── popup.css                    # Botanical forest design system stylesheet
│   ├── popup.js                     # Popup controller, key validator & allFrames script injector
│   └── README.md                    # Assessment Edition documentation
├── CHANGELOG.md                     # Version release history (v1.0.0)
├── CODE_OF_CONDUCT.md               # Community Code of Conduct
├── CONTRIBUTING.md                  # Developer setup, architecture & PR guidelines
├── DISCLAIMER.md                    # Academic honor code, ToS & liability disclaimer
├── How_To_Use.md                    # Step-by-step installation, usage & troubleshooting guide
├── LICENSE                          # Apache License 2.0
├── PRIVACY.md                       # Privacy policy, local storage & telemetry transparency
├── README.md                        # Main repository documentation
└── Security.md                      # Security architecture & vulnerability disclosure policy
```

---

## 📚 Documentation Index

| Document | Description |
| :--- | :--- |
| [**How_To_Use.md**](./How_To_Use.md) | Complete installation guide, API key setup, HUD controls, update checks, and troubleshooting FAQ |
| [**SpringBored/README.md**](./SpringBored/README.md) | Deep dive into **SpringBored (Course Edition)** architecture, permissions, and workflow |
| [**SpringBored - Assessment/README.md**](./SpringBored%20-%20Assessment/README.md) | Deep dive into **SpringBored (Assessment Edition)** AI pipeline, iframe support, and HUD inspector |
| [**Security.md**](./Security.md) | API key isolation, `x-goog-api-key` header transport, prompt-injection defense, and vulnerability reporting |
| [**PRIVACY.md**](./PRIVACY.md) | Local storage breakdown, zero-PII guarantee, and anonymous telemetry specification |
| [**DISCLAIMER.md**](./DISCLAIMER.md) | Academic integrity policy, institutional honor code responsibility, and non-affiliation notice |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | Local development workflow, design tokens, testing checklist, and pull request standards |
| [**CHANGELOG.md**](./CHANGELOG.md) | Detailed release notes for `v1.0.0` |
| [**CODE_OF_CONDUCT.md**](./CODE_OF_CONDUCT.md) | Open-source community standards and expectations |

---

## 🛡️ Ethics, Privacy & Security Summary

- **100% Local API Key Storage**: Your Google Gemini API key is stored only in your browser's `chrome.storage.local` and is sent directly to `https://generativelanguage.googleapis.com` via the `x-goog-api-key` HTTP header. It never touches our server or URL query strings.
- **Zero Personal Data**: No names, emails, Springboard credentials, session cookies, course titles, or question/answer texts are ever collected or transmitted.
- **Academic Integrity**: SpringBored is built for educational exploration and developer research. Users are solely responsible for complying with their institution's honor code and platform terms of service. Read the full [**Disclaimer**](./DISCLAIMER.md) and [**Privacy Policy**](./PRIVACY.md).

---

## ⭐ Star & Support My Open-Source Work

If **SpringBored** saved you hours on Infosys Springboard courses or assessments, please consider supporting its continued open-source maintenance:

- ⭐ **Star the Repository on GitHub**: [**github.com/OjasD07/SpringBored**](https://github.com/OjasD07/SpringBored)
- 💖 **Support My OSS (Razorpay)**: [**sponsor.ojasdeshpande.in**](https://sponsor.ojasdeshpande.in/)
- 🌐 **Official Website & Live Telemetry**: [**springbored.ojasdeshpande.in**](https://springbored.ojasdeshpande.in/)

---

## 📄 License

Distributed under the [**Apache License 2.0**](./LICENSE).

---

## Author

**Ojas Deshpande** ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [GitHub @OjasD07](https://github.com/OjasD07) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))

---

<p align="center">
  <a href="https://springbored.ojasdeshpande.in/"><strong>SpringBored</strong></a> &copy; 2026 <a href="https://www.ojasdeshpande.in/"><strong>Ojas Shailesh Deshpande</strong></a>
</p>
