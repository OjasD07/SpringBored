<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# 🔒 Security Policy & Architecture (`v1.0.0`)

> **Security model, API key protection, prompt-injection defenses, runtime isolation, and vulnerability disclosure policy for `SpringBored` and `SpringBored - Assessment`.**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
</p>

---

## 1. Supported Versions

Only the latest release on [**GitHub Releases**](https://github.com/OjasD07/SpringBored/releases) receives security updates and patches:

| Version | Supported | Notes |
| :--- | :---: | :--- |
| `v1.0.x` | ✅ Yes | Current stable Manifest V3 release |
| `< v1.0.0` | ❌ No | Pre-release prototypes (please upgrade via GitHub Releases) |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability in `SpringBored`, `SpringBored - Assessment`, or `springbored.ojasdeshpande.in`, please report it responsibly rather than opening a public GitHub issue:

- 📧 **Email**: [**contact@ojasdeshpande.in**](mailto:contact@ojasdeshpande.in)
- **Subject Line**: `[SECURITY] SpringBored — <Brief Description>`
- **What to Include**:
  1. Affected component (`SpringBored/`, `SpringBored - Assessment/`, or `springbored.ojasdeshpande.in`).
  2. Step-by-step reproduction instructions or proof-of-concept code.
  3. Potential impact (e.g., API key exposure, cross-frame message spoofing, prompt injection, or XSS).
- **Response Timeline**:
  - **Acknowledgement**: Within **48 hours** of receipt.
  - **Triage & Fix**: Critical issues are patched and published to GitHub Releases within **7 days**, with credit in `CHANGELOG.md` (unless anonymity is requested).

---

## 3. Security Architecture

### 🔑 3.1 Client-Side API Key Isolation
- **Local-Only Storage**: In `SpringBored - Assessment`, your Google Gemini API key is stored exclusively inside your browser's isolated extension storage (`chrome.storage.local` under `geminiApiKey`). Content scripts running in web pages only read the key when dispatching a solve request to the extension's own background service worker.
- **Header-Only Authentication (`x-goog-api-key`)**: All requests to `https://generativelanguage.googleapis.com` transmit the API key via the `x-goog-api-key` HTTP request header — **never** in URL query parameters (`?key=...`), preventing accidental exposure in browser network logs or proxy URLs.
- **No Proxy or Intermediary Key Relay**: Prompts and API keys go directly from your browser's background service worker to Google's official `generativelanguage.googleapis.com` API. The SpringBored telemetry worker (`springbored.ojasdeshpande.in`) never receives API keys, prompts, or question content.

### 🛡️ 3.2 Prompt-Injection & Untrusted DOM Defense
Assessment pages contain untrusted third-party text (questions, code snippets, and options). To prevent malicious question text from hijacking the AI prompt or breaking out of structural boundaries:
- **Input Sanitization (`sanitizeText`)**: Strips control characters, normalizes whitespace, caps stem/option lengths, and neutralizes delimiter sequences (`---`, `===`, `###`) before assembling the prompt.
- **Explicit Boundary Delimiters**: Question text and option lists are enclosed in explicit `--- BEGIN QUESTION ---` / `--- END QUESTION ---` and `--- BEGIN OPTIONS ---` / `--- END OPTIONS ---` blocks with system instructions directing the model to treat enclosed content strictly as data.
- **Constrained Output Parser**: `parseLettersResponse()` extracts only valid uppercase option letters (`A`–`Z`) bounded by the actual number of options on screen (`maxOptions`), discarding any free-form text or injected instructions.

### 🔒 3.3 Runtime Message & Cross-Frame Isolation
- **Sender Identity Verification**: Both `background.js` and `content.js` verify `sender.id === chrome.runtime.id` on `chrome.runtime.onMessage` listeners so external extensions or untrusted web scripts cannot spoof internal commands (`SOLVE_QUESTION`, `DISPATCH_ACTION`, `STATUS_UPDATE`).
- **Top-Frame Domain Guard**: Because `SpringBored - Assessment` supports cross-origin embedded assessment iframes (`all_frames: true`), `content.js` enforces an immediate top-frame domain guard at startup:
  - When `window === window.top`, the script checks that `location.hostname` belongs to Infosys Springboard (`onwingspan.com`) or a known assessment host (`techademy.com`, `techademyone.com`, `yaksha.com`, `iiht.com`). On any other website, `content.js` exits at line 1 without registering listeners or touching the DOM.
  - When running inside a child iframe (`window !== window.top`), the script stays dormant until assessment DOM elements (`hasActualAssessmentContent()`) are detected or an explicit `START` command is broadcast to that tab by the user.

### 🧱 3.4 Content Security Policy (CSP) & Zero Dependencies
- **Strict Manifest V3 CSP**: Both extensions enforce:
  ```json
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
  ```
  Inline scripts, `eval()`, and remote code execution are blocked across all extension pages.
- **Zero NPM / Third-Party Runtime Dependencies**: Both extensions are written in 100% auditable vanilla JavaScript, HTML, and CSS with zero bundled third-party scripts.

---

## ⭐ Star & Support My Open-Source Work

- ⭐ **Star the Repo**: [github.com/OjasD07/SpringBored](https://github.com/OjasD07/SpringBored)
- 💖 **Support My OSS (Razorpay)**: [sponsor.ojasdeshpande.in](https://sponsor.ojasdeshpande.in/)
- 🌐 **Official Website**: [springbored.ojasdeshpande.in](https://springbored.ojasdeshpande.in/)

---

## Author

**Ojas Deshpande** ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [GitHub @OjasD07](https://github.com/OjasD07) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))

---

<p align="center">
  <a href="https://springbored.ojasdeshpande.in/"><strong>SpringBored</strong></a> &copy; 2026 <a href="https://www.ojasdeshpande.in/"><strong>Ojas Shailesh Deshpande</strong></a>
</p>
