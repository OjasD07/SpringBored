<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# 🤝 Contributing to SpringBored (`v1.0.0`)

> **Developer guide, architecture overview, design system conventions, and pull request checklist for contributing to `SpringBored` and `SpringBored - Assessment`.**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
</p>

Thank you for your interest in contributing to **SpringBored**! Whether you are fixing a DOM selector for a new Infosys Springboard / Techademy layout, improving Gemini prompt accuracy, or refining the UI, contributions are welcome.

By participating in this project, you agree to abide by our [**Code of Conduct**](./CODE_OF_CONDUCT.md) and license your contributions under the [**Apache License 2.0**](./LICENSE).

---

## 1. Architectural Principles

1. **Zero Build Step / Zero External Dependencies**:
   - Both `SpringBored/` and `SpringBored - Assessment/` are pure, dependency-free **Manifest V3** Chrome extensions written in vanilla JavaScript, HTML, and CSS.
   - Any user or reviewer must be able to clone the repository (or unzip a release archive) and load either folder directly via `chrome://extensions` → **Load unpacked** without running `npm install` or a bundler.
2. **Strict Separation of Editions**:
   - **`SpringBored/` (Course Edition)** must **never** automate quizzes or assessments or require an API key.
   - **`SpringBored - Assessment/` (Assessment Edition)** focuses exclusively on quiz, IAP assessment, and Techademy assessment solving.
3. **Security & Privacy First**:
   - Never log or transmit `geminiApiKey`, user credentials, or question/course content outside the user's browser.
   - Always pass the Gemini API key via the `x-goog-api-key` HTTP header — never in URL query strings.
   - Preserve `sender.id === chrome.runtime.id` verification on runtime message listeners and keep `sanitizeText()` prompt-injection guards intact.

---

## 2. Local Development Workflow

1. **Fork and Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/SpringBored.git
   cd SpringBored
   ```
2. **Load Unpacked in Chrome**:
   - Open `chrome://extensions/` and enable **Developer mode**.
   - Click **Load unpacked** and select `SpringBored/` and/or `SpringBored - Assessment/`.
3. **Making & Testing Changes**:
   - After editing `popup.html`, `popup.css`, or `popup.js`, simply close and reopen the extension popup to see your changes immediately.
   - After editing `background.js`, `content.js`, or `manifest.json`, click the **Reload (`↻`)** button on `chrome://extensions/` and refresh your Infosys Springboard tab.

---

## 3. Botanical Forest Design System & Branding Conventions

All visual surfaces (Course popup, Assessment popup, floating HUD, and `.md` documentation) follow a unified **Botanical Forest** palette inspired by the SpringBored emblem:

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--paper` / `--bg-deep` | `#1e3a2b` / `#162b21` | Primary deep forest green canvas & popup background |
| `--paper-2` / `--bg-surface` | `#244534` | Elevated card surface & logo badge background |
| `--ink` / `--cream` | `#f3ebd3` | Warm cream primary typography |
| `--ink-2` / `--cream-soft` | `#d8d0b8` | Secondary body copy |
| `--ink-3` / `--sage-muted` | `#9db096` | Muted sage labels and metadata |
| `--accent` / `--gold` | `#e5a952` | Primary ochre gold CTA buttons, active badges, and links |
| `--coral` | `#e6926d` | Terracotta coral secondary accent (`♥ Support my OSS`, warnings) |
| `--green` | `#96c99e` | Mint green active/ready status indicators |

### Mandatory Documentation & UI Conventions
- **Markdown Header Logos**: Every `.md` file must display the author's logo (`Logo.svg`) and the SpringBored logo (`Logo.png`) side by side at the top with a horizontal gap (`&nbsp;&nbsp;&nbsp;&nbsp;`).
- **Centered Copyright Footer**: All popups, the HUD, and `.md` files must maintain the centered copyright attribution linking **SpringBored** to `https://springbored.ojasdeshpande.in/` and **Ojas Shailesh Deshpande** to `https://www.ojasdeshpande.in/`.

---

## 4. Submitting a Pull Request

Before opening a Pull Request:

1. **Verify Syntax & Manifest Validity**:
   - Ensure `manifest.json` in both folders is valid JSON and uses Manifest V3.
   - Ensure no console errors appear in the Service Worker inspector or page DevTools console.
2. **Test Across Target Surfaces**:
   - **Course Edition**: Verify TOC expansion, `16×` video seek (`duration - 3s`), reading **Mark as Complete** + modal confirmation, and quiz skipping.
   - **Assessment Edition**: Verify API key validation, model switching, standard quizzes, multi-section IAP assessments, cross-origin Techademy iframes, and the floating HUD (`Alt + S`) + Inspector drawer.
3. **Keep Commits Clean & Focused**:
   - Write clear, descriptive commit messages summarizing *what* changed and *why*.

---

## ⭐ Star & Support My Open-Source Work

- ⭐ **Star the Repo**: [github.com/OjasD07/SpringBored](https://github.com/OjasD07/SpringBored)
- 💖 **Support My OSS (Razorpay)**: [sponsor.ojasdeshpande.in](https://sponsor.ojasdeshpande.in/)
- 🌐 **Official Website**: [springbored.ojasdeshpande.in](https://springbored.ojasdeshpande.in/)

---

## Author

**Ojas Shailesh Deshpande** ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [GitHub @OjasD07](https://github.com/OjasD07) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))

---

<p align="center">
  <a href="https://springbored.ojasdeshpande.in/"><strong>SpringBored</strong></a> &copy; 2026 <a href="https://www.ojasdeshpande.in/"><strong>Ojas Shailesh Deshpande</strong></a>
</p>
