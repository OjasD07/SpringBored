<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# 🛡️ Privacy Policy & Telemetry Transparency (`v1.1.0`)

> **Complete disclosure of local browser storage, third-party API calls, and anonymous aggregate impact telemetry for `SpringBored`, `SpringBored - Assessment`, and `springbored.ojasdeshpande.in`.**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
  <a href="https://springbored.ojasdeshpande.in/privacy.html"><img src="https://img.shields.io/badge/Web_Policy-springbored.ojasdeshpande.in%2Fprivacy.html-f3ebd3?style=for-the-badge&labelColor=244534" alt="Web Privacy Policy" /></a>
</p>

---

## 1. Zero Personal Data Collection

**SpringBored does not collect, log, store, or transmit any personally identifiable information (PII).**

Specifically, neither extension ever collects or transmits:
- Your name, email address, student ID, or institution details.
- Your Infosys Springboard login credentials, authentication tokens, or session cookies.
- Your Google Gemini API key (`AIzaSy...`).
- The text of any course, lecture, question stem, code snippet, or answer choice.
- Your browsing history outside Infosys Springboard.

---

## 2. Local Browser Storage (`chrome.storage.local`)

All user configuration and personal impact counters are stored locally on your own device inside Chrome's extension storage (`chrome.storage.local`):

| Storage Key | Edition | Stored Value & Purpose |
| :--- | :--- | :--- |
| `sbConsent` | Both | `{ accepted: boolean, version: "1.1.0", acceptedAt: number }` — records whether you have accepted the Privacy & Terms notice. Automation stays disabled until `accepted === true`. |
| `geminiApiKey` | Assessment | Your Google Gemini API key string (`AIzaSy...`), used exclusively to authenticate direct requests to `generativelanguage.googleapis.com`. |
| `geminiModel` | Assessment | Your selected Gemini model ID (defaults to `"gemini-2.5-flash"`). |
| `sbLocalStats` | Both | Your local cumulative counters (`lecturesCompleted`, `modulesCompleted`, `coursesCompleted` or `questionsSolved`, `assessmentsCompleted`, plus `activeSeconds` and `savedSeconds`) displayed in the popup's personal impact strip. |
| `sbInstallId` | Both | A randomly generated anonymous UUID (`crypto.randomUUID()`) used only as an anonymous `client_id` for aggregate telemetry counters. |
| `sbUpdateInfo` | Both | Cached latest version metadata (`latestVersion`, `hasUpdate`, `releaseUrl`, `checkedAt`) from GitHub Releases so the extension does not poll on every popup open. |

**How to Delete All Local Data**: You can withdraw consent at any time by clicking **Privacy & terms → Withdraw consent** in the popup footer, or erase all stored keys permanently by removing the extension on `chrome://extensions/`.

---

## 3. Direct Google Gemini API Communication (Assessment Edition)

When you run **SpringBored - Assessment**, the extension extracts the visible question stem, options, and any inline diagram from the active assessment DOM and sends them **directly from your browser** to Google's official Generative Language API:

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`
- **Authentication**: `x-goog-api-key` HTTP header using your locally stored API key.
- **Governing Policy**: Requests processed by Google AI Studio / Gemini API are governed by the [Google Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) and [Google Privacy Policy](https://policies.google.com/privacy).

---

## 4. Anonymous Aggregate Telemetry & Update Checks

To power the live public impact counters and 52-week usage heatmap on [**springbored.ojasdeshpande.in**](https://springbored.ojasdeshpande.in/), and to notify you when a new version is released on GitHub, the extensions make two lightweight requests:

### 4.1 Anonymous Telemetry Beacons (`POST https://springbored.ojasdeshpande.in/api/telemetry`)
- **When Sent**: Only **after** you have accepted the Privacy & Terms agreement, when a lecture, module, course, question, or assessment is completed.
- **Exact JSON Payload**:
  ```json
  {
    "edition": "course | assessment",
    "version": "1.1.0",
    "installId": "<random-anonymous-uuid>",
    "event": "lecture_completed | question_solved | assessment_completed | ...",
    "deltas": {
      "lecturesCompleted": 1,
      "modulesCompleted": 0,
      "coursesCompleted": 0,
      "questionsSolved": 0,
      "assessmentsCompleted": 0,
      "activeSeconds": 12
    }
  }
  ```
- **Zero Content or PII**: No URLs, course names, question text, API keys, or user identifiers are included in telemetry payloads.
- **Website Analytics**: The official website (`springbored.ojasdeshpande.in`) uses Google Analytics (`G-5WLGPCFWZL`) and Cloudflare Workers KV (`SPRINGBORED_KV`) to display aggregate community usage and GitHub Release download counts.

### 4.2 Version Update Check (`GET /api/version` & GitHub Releases API)
- Every 6 hours (or when you click **Check updates** in the popup footer), `background.js` queries `https://springbored.ojasdeshpande.in/api/version` (with a fallback to `https://api.github.com/repos/OjasD07/SpringBored/releases`) to compare your installed `manifest.json` version against the latest GitHub Release tag.

---

## 5. Contact

For any privacy questions or data inquiries, contact:
- **Ojas Deshpande** — [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in)

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
