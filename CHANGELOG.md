<p align="left">
  <a href="https://www.ojasdeshpande.in" target="_blank"><img src="https://raw.githubusercontent.com/OjasD07/OjasD07/main/Logo.svg" alt="Ojas Deshpande Logo" width="88" height="88" style="width: 88px; height: 88px; background: #ffffff; border-radius: 10px; padding: 8px; margin: 0 16px 8px 0; vertical-align: middle;" /></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://springbored.ojasdeshpande.in" target="_blank"><img src="./SpringBored/Assets/Logo.png" alt="SpringBored Logo" width="88" height="88" style="width: 88px; height: 88px; background: #244534; border-radius: 10px; padding: 4px; margin: 0 0 8px 0; vertical-align: middle;" /></a>
</p>

# 📋 Changelog

> **All notable changes to `SpringBored` (Course Edition) and `SpringBored - Assessment` (Assessment Edition) are documented in this file.**

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [`v1.1.0`] — 2026-11-06

### ✨ Changed & Improved — Both Editions (`v1.1.0`)
- **Refreshed Botanical Forest Popup UI**:
  - Added a unified `.hero-card` container combining live status and progress tracking.
  - Added a collapsible **AI engine** summary bar (`Configure` / `Done` toggle) in Assessment Edition that auto-collapses the API key card once a key is verified.
  - Redesigned the 3-column **Personal Impact** ledger (`Time saved`, `Lectures` / `Solved`, `Courses` / `Assessments`) with custom vector icons.
  - Upgraded the first-run **Before you begin** consent card with a botanical leaf watermark and quick-reopen footer note.
  - Streamlined the popup footer action row (`v1.1.0 · Updates · Privacy · ★ Star · ♥ Sponsor`).
- **Upgraded Fullscreen Assessment HUD (`SpringBored - Assessment`)**:
  - Replaced text glyphs in the HUD header toolbar with crisp inline SVG icons (`Switch corner`, `Expand inspector`, `Minimize`, `Close`).
  - Added a top gradient accent bar and unified HUD footer (`SpringBored · Ojas Deshpande · ★ Star · ♥ Sponsor`) that collapses cleanly when minimized.

---

## [`v1.0.0`] — 2026-11-02 (Initial Public Open-Source Release)

### ✨ Added — `SpringBored` (Course Edition `v1.0.0`)
- **Autonomous 16× Video Playback Engine**: Automatically mutes HTML5 video lectures, accelerates playback to `16×`, and seeks to `duration − 3s` so Infosys Springboard's native completion events fire naturally.
- **Automatic Reading & Web-Module Completion**: Detects reading materials and web modules, triggers **Mark as Complete**, and automatically confirms *"learning duration"* modal dialogs.
- **Recursive Multi-Module TOC Traversal**: Opens the course **Contents** drawer, expands collapsed module/folder accordions, and progresses across module boundaries while skipping quizzes and graded assessments.
- **Personal Impact Stats Strip**: Tracks cumulative **Lectures**, **Modules**, and **Time Saved** in the popup UI.
- **GitHub Releases Update Nudge**: Checks `/api/version` and GitHub Releases (`OjasD07/SpringBored`) and displays a `NEW` badge + update banner when a newer version is available.

### ✨ Added — `SpringBored - Assessment` (Assessment Edition `v1.0.0`)
- **Multi-Model Google Gemini AI Pipeline**: Defaults to `gemini-2.5-flash` with an automatic fallback cascade (`gemini-2.5-flash` → `gemini-3-flash-preview` → `gemini-2.5-pro` → `gemini-3.1-pro-preview` → `gemini-2.5-flash-lite` → `gemini-2.0-flash` → dynamic `/v1beta/models` discovery).
- **Thinking Budgets & Two-Pass Self-Critic**: Configures `thinkingBudget` (`4096` Pro / `2048` Flash) with `temperature: 0.0` and runs a second critic verification pass on multi-select, code-tracing, numerical/table, and negation questions.
- **High-Fidelity DOM & Multimodal Scraper**: Preserves code block indentation (`<pre>`, `<code>`, Ace, Monaco, CodeMirror), converts HTML `<table>` elements into Markdown tables, extracts LaTeX/MathJax/KaTeX and `<sup>`/`<sub>` exponents, and sends inline diagrams (`<img>` / `<canvas>`) as multimodal vision inputs.
- **Standard, Multi-Section IAP & Cross-Origin Techademy Support**: Full navigation across standard Springboard quizzes, multi-section IAP assessments (`SECTIONS` tab + palette), and cross-origin embedded Techademy iframes (`all_frames: true`, sequential `Save & Next`, and automatic topic accordion expansion).
- **Draggable Fullscreen HUD (`Alt + S` / `F2`)**: In-page overlay with cross-frame status relay, **Live AI Inspector** drawer, update nudge banner, and one-click solver controls.

### 🎨 Design & Ecosystem
- **Botanical Forest Brand Identity**: Unified forest-green (`#244534` / `#162b21`), warm cream (`#f3ebd3`), ochre gold (`#e5a952`), and terracotta coral (`#e6926d`) theme across both extensions, the in-page HUD, and the official website.
- **Official Website & Live Telemetry (`springbored.ojasdeshpande.in`)**: Launched companion Cloudflare Worker website featuring live community impact counters and a 52-week GitHub-style usage heatmap.
- **Open-Source Community Links**: Integrated `★ Star the Repo` (`https://github.com/OjasD07/SpringBored`) and `♥ Support my OSS` (`https://sponsor.ojasdeshpande.in/`) across all surfaces.

---

## Author

**Ojas Deshpande** ([www.ojasdeshpande.in](https://www.ojasdeshpande.in/) · [GitHub @OjasD07](https://github.com/OjasD07) · [contact@ojasdeshpande.in](mailto:contact@ojasdeshpande.in))

---

<p align="center">
  <a href="https://springbored.ojasdeshpande.in/"><strong>SpringBored</strong></a> &copy; 2026 <a href="https://www.ojasdeshpande.in/"><strong>Ojas Shailesh Deshpande</strong></a>
</p>
