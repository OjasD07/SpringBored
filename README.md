<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 8px 8px 0; vertical-align: middle;" /></a>
  <a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 8px; vertical-align: middle;" /></a>
</p>

# ⚡ SpringBored

> **Intelligent, autonomous course & assessment automation for Infosys Springboard (`infyspringboard.onwingspan.com`).**

<p align="left">
  <a href="https://github.com/OjasD07/SpringBored"><img src="https://img.shields.io/badge/%E2%98%85_Star_the_Repo-GitHub-e5a952?style=for-the-badge&logo=github&logoColor=162b21&labelColor=244534" alt="Star the Repo on GitHub" /></a>
  <a href="https://sponsor.ojasdeshpande.in/"><img src="https://img.shields.io/badge/%E2%99%A5_Support_My_OSS-Sponsor-e6926d?style=for-the-badge&logo=razorpay&logoColor=162b21&labelColor=244534" alt="Support My OSS" /></a>
  <a href="https://github.com/OjasD07/SpringBored/releases/latest"><img src="https://img.shields.io/badge/Release-v1.0.0-96c99e?style=for-the-badge&labelColor=244534" alt="Release v1.0.0" /></a>
  <a href="https://springbored.ojasdeshpande.in/"><img src="https://img.shields.io/badge/Website-springbored.ojasdeshpande.in-f3ebd3?style=for-the-badge&labelColor=244534" alt="Official Website" /></a>
</p>

SpringBored is split into two specialized, standalone extensions:

| Edition | Folder | Description | AI Support |
| :--- | :--- | :--- | :---: |
| [**SpringBored**](./SpringBored) | `SpringBored/` | **Course Completer**: 16× video accelerator, auto-reading mark completed, confirmation dialog handler, and multi-module course tree navigator. Skips quizzes for manual review. | ❌ No | 
| [**SpringBored Assessment**](./SpringBored%20-%20Assessment) | `SpringBored - Assessment/` | **Assessment & Quiz Solver**: Powered by **Google Gemini AI**. Autonomously attempts multi-section assessments (IAP) and quizzes, reads code snippets and options, auto-selects correct answers, saves, and submits tests. | ✅ Yes (Gemini - Free Tier Also Works) |

---

## 🚀 Quick Start

### 1. Choose your edition
- **Course Completer (Videos & Readings)**: Load the `SpringBored/` folder.
- **Assessment Solver (Quizzes & Tests)**: Load the `SpringBored - Assessment/` folder and paste your free [Google Gemini API Key](https://aistudio.google.com/app/apikey) in settings.

### 2. Install in Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Toggle **Developer mode** on (top-right corner).
3. Click **Load unpacked** and select `SpringBored` or `SpringBored - Assessment`.
4. Pin the extension to your toolbar.

### 3. Usage
- **For Course Completer (`SpringBored/`)**:
  1. Open any course player (`/viewer/`).
  2. Click the extension icon and press **Run course**.
- **For Assessment Solver (`SpringBored - Assessment/`)**:
  1. Open any quiz or assessment tab.
  2. Use the floating **SpringBored** panel in the corner, press **Alt + S**, or click **Solve assessment** in the extension popup.

---

## 📁 Repository Structure

```
SpringBored/
├── SpringBored/                 # Course Completer (Videos, reading materials, module navigation)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── README.md
│
└── SpringBored - Assessment/    # Assessment Edition (Autonomous Gemini AI Quiz & Assessment Solver)
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── popup.html
    ├── popup.css
    ├── popup.js
    └── README.md
```

---

## 🛡️ Ethics & Disclaimer

SpringBored is designed for educational exploration and workflow productivity. Users are solely responsible for compliance with their institution's honor code and terms of service.

---

## ⭐ Star & Support My Open-Source Work

If **SpringBored** saved you hours on Infosys Springboard courses or assessments, consider supporting its continued open-source development:

- ⭐ **Star the Repository**: [github.com/OjasD07/SpringBored](https://github.com/OjasD07/SpringBored)
- 💖 **Support My OSS (Razorpay)**: [sponsor.ojasdeshpande.in](https://sponsor.ojasdeshpande.in/)
- 🌐 **Live Telemetry & Website**: [springbored.ojasdeshpande.in](https://springbored.ojasdeshpande.in/)

---

## Author

Ojas Shailesh Deshpande ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))
