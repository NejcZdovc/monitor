# Monitor

A lightweight macOS menu bar app that automatically tracks how you spend time on your computer. It runs quietly in the background, recording which apps you use, how much you type, and how long you spend in meetings or watching YouTube — then presents it all in a clean, dark-themed dashboard.

No cloud. No accounts. Everything stays local on your machine in a SQLite database.

![macOS](https://img.shields.io/badge/platform-macOS-000000?logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/electron-40-47848F?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)

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
- **Idle detection** — automatically pauses tracking after 5 minutes of inactivity; resumes when you return
- **Call detection** — detects active calls in Zoom, Microsoft Teams, Google Meet, and FaceTime; suppresses idle detection during calls
- **YouTube tracking** — detects YouTube playing in any browser (12 browsers supported), even when the browser is not focused
- **AI time tracking** — tracks time spent with AI tools both as native apps and in browser tabs
- **Project detection** — extracts project names from IDE window titles (VS Code, Cursor, JetBrains, Zed, Sublime Text)
- **Sleep/wake resilience** — automatically recovers input and window tracking after macOS sleep cycles

### Smart Categorization

Apps are automatically sorted into categories:

| Category      | Examples                                          |
| ------------- | ------------------------------------------------- |
| Coding        | VS Code, Cursor, Xcode, JetBrains suite, Zed, Neovim, Sublime Text |
| Terminal      | Terminal, iTerm2, Warp, Ghostty, Alacritty, kitty |
| AI            | Claude, ChatGPT, Copilot, Ollama, Perplexity, Poe |
| Communication | Slack, Discord, Messages, Mail, Telegram, WhatsApp |
| Meetings      | Zoom, Teams, FaceTime, Google Meet, Webex, Skype  |
| Browsers      | Chrome, Safari, Firefox, Arc, Brave, Edge, Vivaldi, Orion, Zen Browser |
| Productivity  | Notion, Obsidian, Figma, Sketch, Office suite, Linear, Bear |
| DevTools      | Postman, Docker, TablePlus, Tower, GitKraken, Proxyman |
| Entertainment | Spotify, YouTube, Music, Netflix, Twitch, VLC     |
| System        | System Settings, Activity Monitor, Disk Utility   |

AI usage in browsers (Claude, ChatGPT, Gemini, Perplexity, Midjourney, Hugging Face, etc.) is automatically detected and categorized from window titles.

### Dashboard

- **Summary cards** — active time, keystrokes, mouse clicks, call time, entertainment time, AI time
- **Active time chart** — hourly (today) or daily breakdown of active vs. idle time; click a bar to drill down
- **Input activity chart** — keystroke and click trends over time
- **Categories doughnut** — visual breakdown by category, click to drill down into individual apps
- **Top apps** — ranked bar chart of most-used applications, color-coded by category
- **Project breakdown** — top 10 coding projects extracted from IDE window titles
- **AI time chart** — daily breakdown by AI tool (Claude, ChatGPT, Perplexity, etc.)
- **Call time chart** — time spent in calls by service (Zoom, Teams, FaceTime, Google Meet)
- **Entertainment chart** — foreground entertainment apps plus background YouTube consumption
- **Hour drill-down** — click any hourly bar to see all apps active during that hour
- **Day drill-down** — click any daily bar to drill into that day's hourly breakdown
- **Time range picker** — today, this week, this month, or custom date range
- **Auto-refresh** — dashboard updates every 30 seconds while focused

### Menu Bar

- Tray icon with a quick-stats popup showing today's active time, keystrokes, clicks, call time, entertainment, AI time, and top app
- Pause/resume tracking with status indicator
- Open dashboard or quit from the tray

## Download

1. Go to the [Releases](https://github.com/NejcZdovc/monitor/releases/latest) page
2. Download **Monitor.dmg** (or the ZIP)
3. Open the DMG and drag **Monitor** to your Applications folder
4. Launch Monitor from Applications

On first launch, macOS will ask you to grant **Accessibility** permission:

1. Go to **System Settings → Privacy & Security → Accessibility**
2. Enable **Monitor** in the list

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

### Scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Run the app in development mode |
| `npm test` | Run the test suite (Jest) |
| `npm run package` | Package the app for distribution |
| `npm run make` | Create DMG and ZIP installers |
| `npm run lint` | Lint with Biome |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run full-check` | Run lint, typecheck, and tests |

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

The workflow bumps the version in `package.json`, creates a git tag, builds the app on macOS, and uploads ZIP and DMG artifacts as a GitHub Release. Go to the repo's [Releases](https://github.com/NejcZdovc/monitor/releases) page to review and publish.

### Auto Updates

The app uses `electron-updater` to check for updates from GitHub Releases every 24 hours. Updates download silently in the background and install automatically when the user quits the app. Failed checks are retried up to 3 times with a 60-second delay.

Users can also check manually via the app menu (**Monitor → Check for Updates...**).

> **Note:** Auto-updates on macOS require a code-signed build. Add `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` as repository secrets for notarization.

## Architecture

```
src/
├── main/                        # Electron main process (TypeScript)
│   ├── main.ts                  # App entry point
│   ├── auto-updater.ts          # GitHub Releases auto-updater
│   ├── tray.ts                  # Menu bar tray icon + popup
│   ├── window-manager.ts        # Dashboard window lifecycle
│   ├── ipc-handlers.ts          # IPC bridge between main ↔ renderer
│   ├── categories.ts            # App → category mapping rules
│   ├── constants.ts             # Shared config (poll intervals, thresholds)
│   ├── types.ts                 # Shared TypeScript types
│   ├── data/
│   │   ├── database.ts          # SQLite schema, migrations, orphan cleanup
│   │   ├── query-engine.ts      # Dashboard read queries (prepared statements)
│   │   ├── activity-store.ts    # Activity session writes
│   │   ├── input-store.ts       # Input count writes
│   │   ├── call-store.ts        # Call session writes
│   │   └── background-entertainment-store.ts  # YouTube session writes
│   └── tracking/
│       ├── tracker-manager.ts   # Orchestrates all trackers
│       ├── window-tracker.ts    # Active window polling (AppleScript)
│       ├── input-tracker.ts     # Keystroke/click aggregation (main thread)
│       ├── input-worker.ts      # Keystroke/click hooks (worker thread)
│       ├── idle-detector.ts     # System idle detection
│       ├── call-detector.ts     # Call process detection (pgrep)
│       ├── youtube-tracker.ts   # Background YouTube detection
│       ├── session-lifecycle.ts # Reusable session open/split/close state machine
│       └── hour-split.ts        # Hour-boundary splitting utilities
├── renderer/
│   ├── main_window/             # Dashboard UI
│   │   ├── index.html
│   │   ├── styles/main.css
│   │   └── js/
│   │       ├── app.ts           # Dashboard controller
│   │       ├── date-utils.ts
│   │       ├── format-utils.ts
│   │       └── components/      # Chart components (Chart.js)
│   ├── tray_popup/              # Tray quick-stats popup
│   │   ├── index.html
│   │   └── styles/tray.css
│   ├── preload.ts               # Main window context bridge
│   └── tray-preload.ts          # Tray popup context bridge
├── assets/                      # Icons, update manifest
└── test/                        # Jest test suite
```

### Key Design Decisions

- **TypeScript** — the entire codebase is TypeScript, built with Vite via electron-forge
- **AppleScript for window titles** — only requires Accessibility permission (not Screen Recording)
- **Worker thread for input tracking** — prevents keystroke hooks from blocking the main thread; auto-restarts after macOS sleep since IOKit event taps become invalid
- **Hour-boundary splitting** — all sessions are split at hour boundaries during tracking (not at query time), making hourly aggregation queries trivially correct
- **Idle suppression during calls** — idle detection is suppressed when Zoom, Teams, Google Meet, or FaceTime calls are active
- **Retroactive idle timestamps** — idle start is calculated retroactively (`now - idleSeconds`) for accurate session boundaries
- **SQLite with WAL mode** — fast, embedded, zero-config database using `better-sqlite3`
- **No frameworks** — vanilla TypeScript frontend with Chart.js for visualization
- **Biome** for linting and formatting

## Privacy

Monitor is designed to be privacy-first:

- All data is stored locally in a SQLite database in your app data directory
- No network requests except update checks to GitHub Releases — no telemetry, no analytics
- Input tracking records **counts only** — it does not log what you type
- Window titles are stored locally for categorization — they are never transmitted

## License

MIT
