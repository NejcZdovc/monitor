# Plan: Add Windows Support to Monitor

## Context
Monitor is currently a macOS-only Electron menu bar app. Three core tracking modules rely on AppleScript (`osascript`) and Unix utilities (`pgrep`) that don't exist on Windows. The goal is to make the app cross-platform (macOS + Windows) by introducing a platform abstraction layer and adding Windows-specific implementations, build config, and assets.

**Already cross-platform (no changes needed):**
- InputTracker — `uiohook-napi` supports Windows natively
- IdleDetector — Electron's `powerMonitor.getSystemIdleTime()` is cross-platform
- SQLite database, query engine, renderer, all charts

---

## Phase 1: Platform Abstraction Layer

Create `src/main/platform/` with a shared interface and per-platform implementations.

### 1.1 Create `src/main/platform/types.ts`
Define the interface all platform adapters implement:
- `getActiveWindow(): Promise<{ appName, windowTitle } | null>`
- `isProcessRunning(processName: string): Promise<boolean>`
- `isYouTubePlaying(): Promise<boolean>`
- `needsAccessibilityPermission(): boolean`
- `requestAccessibilityPermission(): boolean`

### 1.2 Create `src/main/platform/darwin.ts`
Extract existing code from trackers — **no behavior change on macOS**:
- `getActiveWindow()` — the AppleScript from `window-tracker.ts` lines 12-27 (parses `appName|||windowTitle`)
- `isProcessRunning()` — the `pgrep -x` call from `call-detector.ts` line 46
- `isYouTubePlaying()` — the browser-scanning AppleScript from `youtube-tracker.ts` lines 10-30
- `needsAccessibilityPermission()` → `true`
- `requestAccessibilityPermission()` → `systemPreferences.isTrustedAccessibilityClient(true)`

### 1.3 Create `src/main/platform/win32.ts`
New Windows implementation using `active-win` npm package:
- `getActiveWindow()` — `activeWindow()` from `active-win`, strip `.exe` from `owner.name`
- `isProcessRunning()` — `tasklist /FI "IMAGENAME eq <name>" /NH`
- `isYouTubePlaying()` — `openWindows()` from `active-win`, filter browser windows for YouTube + audio indicators in title
- `needsAccessibilityPermission()` → `false`
- `requestAccessibilityPermission()` → `true`

### 1.4 Create `src/main/platform/index.ts`
Factory: returns `DarwinAdapter` or `Win32Adapter` based on `process.platform`.

### 1.5 Install dependency
```
npm install active-win
```
> `active-win` v9+ is ESM-only. Vite handles ESM via dynamic `import()`. If issues, fall back to v8.x.

---

## Phase 2: Refactor Trackers to Use Platform Adapter

### 2.1 `src/main/tracking/window-tracker.ts`
- Accept `PlatformAdapter` in constructor
- Remove: AppleScript constants, temp file writes, `execFile` import, inline `systemPreferences` check
- `start()`: use `adapter.needsAccessibilityPermission()` / `adapter.requestAccessibilityPermission()`
- `_poll()`: `await adapter.getActiveWindow()` instead of `execFile('osascript', ...)`
- All session management, hour-boundary splitting, Meet/FaceTime detection **unchanged**

### 2.2 `src/main/tracking/youtube-tracker.ts`
- Accept `PlatformAdapter` in constructor
- Remove: AppleScript constants and temp file writes
- `_poll()`: `await adapter.isYouTubePlaying()` instead of `execFile('osascript', ...)`
- Session start/end logic **unchanged**

### 2.3 `src/main/tracking/call-detector.ts`
- Accept `PlatformAdapter` in constructor
- Remove: `execFile` import
- `_check()`: `await adapter.isProcessRunning(app.process)` instead of `pgrep`
- Platform-specific process names:
  - macOS: `CptHost`, `Teams`
  - Windows: `CptHost.exe`, `ms-teams.exe` (+ `Teams.exe` for classic Teams)

### 2.4 `src/main/tracking/input-tracker.ts`
- Wrap `systemPreferences.isTrustedAccessibilityClient()` (line 24) in `if (process.platform === 'darwin')`
- No other changes needed

### 2.5 `src/main/tracking/tracker-manager.ts`
- Import `createPlatformAdapter` from `../platform`
- Create adapter and pass to `WindowTracker`, `YouTubeTracker`, `CallDetector` constructors

---

## Phase 3: Platform-Aware Electron APIs

### 3.1 `src/main/main.ts`
- Line 47: Wrap `systemPreferences.isTrustedAccessibilityClient(true)` in `if (process.platform === 'darwin')`
- Dock calls already guarded by `if (app.dock)` ✓

### 3.2 `src/main/window-manager.ts`
- Lines 32-33: Platform-conditional window chrome:
  - macOS: `titleBarStyle: 'hiddenInset'`, `trafficLightPosition: { x: 15, y: 15 }`
  - Windows: `titleBarStyle: 'hidden'`, `titleBarOverlay: { color: '#1e1e1e', symbolColor: '#d4d4d4', height: 38 }`
- Dock calls already guarded ✓

### 3.3 `src/main/tray.ts`
- Line 62: `setAlwaysOnTop` — `'pop-up-menu'` on macOS, `'screen-saver'` on Windows
- Line 102: Tray icon — `iconTemplate.png` on macOS, `icon.png` on Windows

---

## Phase 4: Add Windows App Names to Categories

### `src/main/categories.ts`
Add to existing arrays:
- **Terminal**: `'Windows Terminal'`, `'WindowsTerminal'`, `'Command Prompt'`, `'cmd'`, `'PowerShell'`
- **Productivity**: `'Explorer'`, `'File Explorer'`, `'Notepad'`, `'Notepad++'`, `'OneNote'`, `'Microsoft To Do'`
- **Entertainment**: `'Groove Music'`, `'Windows Media Player'`, `'Movies & TV'`
- **System**: `'Settings'`, `'Task Manager'`, `'Control Panel'`, `'Registry Editor'`, `'Device Manager'`

---

## Phase 5: Build Config and Assets

### 5.1 Create `assets/icon.ico`
Generate from `icon.png` (multi-resolution: 16, 32, 48, 256px).

### 5.2 Update `forge.config.ts`
- Make `extendInfo`, `osxSign`, `osxNotarize` conditional on `process.platform === 'darwin'`
- Install and add `@electron-forge/maker-squirrel` for Windows installer
- Add `maker-zip` for `win32` platform

### 5.3 Update `package.json`
- Description: `"macOS activity tracker"` → `"Activity tracker for macOS and Windows"`

### 5.4 Update `src/renderer/styles/main.css`
- Line 29: Add `'Segoe UI'` to font stack for Windows system font

---

## Phase 6: Update Tests

### 6.1 Refactor `test/window-tracker.test.ts`
- Replace `child_process.execFile` mocks with `PlatformAdapter` mocks
- `simulatePoll()` now does `mockAdapter.getActiveWindow.mockResolvedValue(...)` instead of faking osascript output
- All 39 existing test assertions stay identical

### 6.2 Add `test/platform-darwin.test.ts` and `test/platform-win32.test.ts`
- Test each adapter in isolation with mocked `execFile`/`active-win`

---

## Verification
1. **macOS**: `npm start` — all tracking, tray, dashboard work identically
2. **TypeScript**: `npm run typecheck` — no errors
3. **Tests**: `npm test` — all tests pass
4. **Lint**: `npm run lint` — clean
5. **macOS package**: `npm run package` — builds and runs
6. **Windows package** (on Windows): `npm run package` — builds `.exe`, app launches, window tracking works

## Files to Create
- `src/main/platform/types.ts`, `darwin.ts`, `win32.ts`, `index.ts`
- `assets/icon.ico`
- `test/platform-darwin.test.ts`, `test/platform-win32.test.ts`

## Files to Modify
- `src/main/tracking/window-tracker.ts` — remove AppleScript, use adapter
- `src/main/tracking/youtube-tracker.ts` — remove AppleScript, use adapter
- `src/main/tracking/call-detector.ts` — remove pgrep, use adapter
- `src/main/tracking/input-tracker.ts` — platform guard on accessibility check
- `src/main/tracking/tracker-manager.ts` — create and inject adapter
- `src/main/main.ts` — platform guard on accessibility prompt
- `src/main/window-manager.ts` — platform-conditional window chrome
- `src/main/tray.ts` — platform-conditional icon and always-on-top
- `src/main/categories.ts` — add Windows app names
- `src/renderer/styles/main.css` — add Segoe UI font
- `forge.config.ts` — add Windows maker, conditional macOS config
- `package.json` — add deps, update description
- `test/window-tracker.test.ts` — mock adapter instead of execFile
