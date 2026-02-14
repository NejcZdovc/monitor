# Monitor

A lightweight macOS menu bar app that automatically tracks how you spend time on your computer. It runs quietly in the background, recording which apps you use, how much you type, and how long you spend in meetings or watching YouTube — then presents it all in a clean, dark-themed dashboard.

No cloud. No accounts. Everything stays local on your machine in a SQLite database.

![macOS](https://img.shields.io/badge/platform-macOS-000000?logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/electron-40-47848F?logo=electron&logoColor=white)

## Why

Most time-tracking tools require manual input or send your data to external servers. Monitor takes a different approach:

- **Fully automatic** — no timers to start or stop, no manual categorization
- **100% local** — your activity data never leaves your machine
- **Zero config** — install, grant Accessibility permission, and it just works
- **Low overhead** — runs in a worker thread, async I/O, no impact on typing or performance

Whether you want to understand your work habits, track how much time you spend coding vs. browsing, or just see if meetings are eating your day — Monitor gives you that visibility with no effort.

## Features

### Automatic Tracking
- **App usage** — tracks the active window every 5 seconds, recording app name, window title, and category
- **Input activity** — counts keystrokes and mouse clicks (aggregated counts only, no keylogging)
- **Idle detection** — automatically pauses tracking after 5 minutes of inactivity
- **Call detection** — detects active calls in Zoom, Microsoft Teams, Google Meet, and FaceTime
- **YouTube tracking** — detects YouTube playing in any browser, even when the browser is not focused

### Smart Categorization
Apps are automatically sorted into categories:

| Category | Examples |
|---|---|
| Coding | VS Code, Cursor, Xcode, IntelliJ, Zed |
| Terminal | Terminal, iTerm2, Warp, Ghostty |
| AI | Claude, ChatGPT, Copilot |
| Communication | Slack, Discord, Messages, Mail |
| Meetings | Zoom, Teams, FaceTime, Google Meet |
| Browsers | Chrome, Safari, Firefox, Arc, Brave |
| Productivity | Notion, Figma, Finder, Notes |
| DevTools | Postman, Docker, TablePlus, Tower |
| Entertainment | Spotify, YouTube, Music |
| System | System Settings, Activity Monitor |

AI usage in browsers (Claude, ChatGPT, etc.) is also detected and categorized automatically.

### Dashboard
- **Summary cards** — active time, keystrokes, mouse clicks, call time, YouTube time
- **Active time chart** — hourly (today) or daily breakdown of active vs. idle time
- **Input activity chart** — keystroke and click trends over time
- **Categories doughnut** — visual breakdown by category, click to drill down into individual apps
- **Top apps** — ranked bar chart of most-used applications
- **Call time chart** — time spent in calls by service
- **YouTube chart** — daily YouTube consumption
- **Time range picker** — today, this week, this month, or custom date range

### Menu Bar
- Tray icon with a quick-stats popup showing today's numbers
- Pause/resume tracking
- Open dashboard or quit from the tray

## Download

1. Go to the [Releases](https://github.com/NejcZdovc/monitor/releases/latest) page
2. Download **Monitor.dmg** (or the ZIP)
3. Open the DMG and drag **Monitor** to your Applications folder
4. Launch Monitor from Applications

On first launch, macOS will ask you to grant **Accessibility** permission:

1. Go to **System Settings → Privacy & Security → Accessibility**
2. Enable **Monitor** in the list

> **Note:** The app is not yet code-signed, so macOS will block it. After dragging to Applications, run this in Terminal:
> ```bash
> xattr -d com.apple.quarantine /Applications/Monitor.app
> ```
> Then launch the app normally. You only need to do this once.

## Development

### Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js** 18+ and npm
- **Python** (for building native modules — usually pre-installed on macOS)

### Setup

```bash
# Clone the repository
git clone https://github.com/NejcZdovc/monitor.git
cd monitor

# Install dependencies
npm install

# Run the app
npm start
```

> In development mode the app appears as "Electron" in the Accessibility list. You may need to add it manually:
> Click **+** → navigate to `node_modules/electron/dist/Electron.app` → Open

### Building for Distribution

```bash
# Package the app
npm run package

# Create a DMG installer
npm run make
```

The packaged app will appear in the `out/` directory. The distributed version shows as "Monitor" in all system menus and uses the correct app icon.

### Publishing a Release

Releases are published via a manual GitHub Actions workflow:

1. Go to **Actions → Publish → Run workflow**
2. Select the version bump type: `patch`, `minor`, or `major`
3. Click **Run workflow**

The workflow bumps the version in `package.json`, creates a git tag, builds the app on macOS, and uploads ZIP and DMG artifacts as a draft GitHub Release. Go to the repo's [Releases](https://github.com/NejcZdovc/monitor/releases) page to review and publish the draft.

### Auto Updates

The app checks for updates every hour via [update.electronjs.org](https://update.electronjs.org). When a new release is published on GitHub, users are notified and can update with one click.

> **Note:** Auto-updates on macOS require a code-signed build. Add `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` as repository secrets for notarization.

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── main.js              # App entry point
│   ├── tray.js              # Menu bar tray icon + popup
│   ├── window-manager.js    # Dashboard window lifecycle
│   ├── ipc-handlers.js      # IPC bridge between main ↔ renderer
│   ├── categories.js        # App → category mapping rules
│   ├── data/
│   │   ├── database.js      # SQLite schema and stores
│   │   └── query-engine.js  # Dashboard queries
│   └── tracking/
│       ├── tracker-manager.js  # Orchestrates all trackers
│       ├── window-tracker.js   # Active window polling (AppleScript)
│       ├── input-tracker.js    # Keystroke/click aggregation
│       ├── input-worker.js     # Worker thread for input hooks
│       ├── idle-detector.js    # System idle detection
│       ├── call-detector.js    # Call process detection
│       └── youtube-tracker.js  # Background YouTube detection
├── renderer/                # Dashboard UI
│   ├── index.html
│   ├── preload.js           # Context bridge API
│   ├── tray-popup.html      # Tray quick-stats popup
│   ├── styles/
│   │   └── main.css
│   └── js/
│       ├── app.js           # Dashboard controller
│       ├── date-utils.js
│       ├── format-utils.js
│       └── components/      # Chart components
└── assets/                  # Icons
```

### Key Design Decisions

- **AppleScript for window titles** — only requires Accessibility permission (not Screen Recording)
- **Worker thread for input tracking** — prevents keystroke hooks from blocking the main thread
- **Async shell commands** — all `osascript` and `pgrep` calls are non-blocking
- **SQLite** — fast, embedded, zero-config database
- **No frameworks** — vanilla JS frontend, minimal dependencies

## Privacy

Monitor is designed to be privacy-first:

- All data is stored locally in a SQLite database in your app data directory
- No network requests, no telemetry, no analytics
- Input tracking records **counts only** — it does not log what you type
- Window titles are stored locally for categorization — they are never transmitted

## License

MIT
