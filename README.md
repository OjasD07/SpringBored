# ⚡ SpringBored

> **Auto-complete every Infosys Springboard course — hands-free.**

A Chrome Extension that automatically navigates through all lessons in an Infosys Springboard course, seeks each video near its end, waits for completion, clicks Next, and repeats — skipping assignments so you review those yourself.

---

## Features

- 🎬 **Auto-plays & seeks videos** to 3 seconds before the end (triggers the completion tick)
- ⏩ **16× playback speed** so nothing lingers
- 📂 **Expands all folders/modules** in the sidebar automatically
- ✅ **Skips already-completed lessons** — resumes from where you left off
- 🚫 **Skips assignments & quizzes** — you handle those manually
- ⏸️ **Pause / Resume / Stop** controls in the popup
- 📊 **Live progress bar** + scrollable activity log

---

## Installation

1. Clone or download this repo
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** → select the `SpringBored` folder
5. The ⚡ icon appears in your toolbar

---

## Usage

1. Open an Infosys Springboard course (`infyspringboard.onwingspan.com`)
2. Navigate to a course player page
3. Click the ⚡ SpringBored icon in your toolbar
4. Press **Start** — the extension takes over from there

> **Tip:** Keep the Springboard tab active (not minimized) for best results, as browsers throttle timers in hidden tabs.

---

## How It Works

```
Open Contents Tab
      ↓
Expand all Modules/Folders
      ↓
Collect all lesson items (skip assignments)
      ↓
For each lesson:
  ├─ Click it in the sidebar
  ├─ Wait for video to load
  ├─ Set speed to 16×, seek to (duration − 3s)
  ├─ Wait for "ended" event
  ├─ Sleep 2s (tick registers)
  └─ Click "Next"
      ↓
Done! 🎉
```

---

## File Structure

```
SpringBored/
├── manifest.json     # Extension manifest (MV3)
├── background.js     # Service worker (message relay)
├── content.js        # Main automation logic (injected into course page)
├── popup.html        # Extension popup UI
├── popup.css         # Popup styles (dark mode, premium)
├── popup.js          # Popup logic (controls + live status)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Notes

- Works on `*.onwingspan.com` and `*.springboard.infosys.com`
- If a video doesn't fire the `ended` event within 10s after seeking, the extension advances anyway
- Non-video content (articles, PDFs, slides) get a 3s dwell time before moving on

---

*For educational use — complete courses faster, not skip learning.*