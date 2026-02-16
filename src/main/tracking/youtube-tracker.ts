import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ActivityStore } from '../data/activity-store'

// AppleScript that scans ALL browser windows (not just focused) for YouTube tabs
// playing audio. Chromium browsers append "Audio playing" to the window title
// when a tab is producing audio. Only requires Accessibility permission.
const APPLESCRIPT_CONTENT = [
  'tell application "System Events"',
  '  set browserNames to {"Brave Browser Beta", "Google Chrome", "Safari", "Arc", "Brave Browser", "Firefox", "Microsoft Edge"}',
  '  repeat with browserName in browserNames',
  '    if exists (application process browserName) then',
  '      tell application process browserName',
  '        try',
  '          set winNames to name of every window',
  '          repeat with winName in winNames',
  '            set winStr to winName as text',
  '            if winStr contains "YouTube" and (winStr contains "Audio playing" or winStr contains "Zvok se predvaja") then',
  '              return "PLAYING"',
  '            end if',
  '          end repeat',
  '        end try',
  '      end tell',
  '    end if',
  '  end repeat',
  '  return ""',
  'end tell',
].join('\n')

const SCRIPT_PATH = path.join(os.tmpdir(), 'monitor-youtube-check.scpt')
fs.writeFileSync(SCRIPT_PATH, APPLESCRIPT_CONTENT, 'utf8')

class YouTubeTracker {
  activityStore: ActivityStore
  pollInterval: number
  timer: ReturnType<typeof setInterval> | null
  currentSession: { id: number; startedAt: number } | null
  checking: boolean

  constructor(activityStore: ActivityStore) {
    this.activityStore = activityStore
    this.pollInterval = 30000 // 30s -- AppleScript browser scan takes ~4s
    this.timer = null
    this.currentSession = null
    this.checking = false
  }

  start() {
    this._poll()
    this.timer = setInterval(() => this._poll(), this.pollInterval)
  }

  _poll() {
    // Skip if previous check is still running
    if (this.checking) return
    this.checking = true

    execFile('osascript', [SCRIPT_PATH], { timeout: 8000 }, (err, stdout) => {
      this.checking = false
      try {
        const isPlaying = !err && stdout.trim() === 'PLAYING'

        if (isPlaying && !this.currentSession) {
          const now = Date.now()
          this.currentSession = { id: 0, startedAt: now }
          this.currentSession.id = this.activityStore.insert({
            appName: 'YouTube',
            windowTitle: 'YouTube - Audio playing',
            category: 'Entertainment',
            startedAt: now,
            endedAt: null,
            durationMs: null,
            isIdle: false,
          })
        } else if (!isPlaying && this.currentSession) {
          this._endSession()
        }
      } catch (_e) {
        // Silently ignore
      }
    })
  }

  _endSession(endTime?: number) {
    if (!this.currentSession) return
    const now = endTime || Date.now()
    this.activityStore.update(this.currentSession.id, now)
    this.currentSession = null
  }

  isPlaying(): boolean {
    return this.currentSession !== null
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this._endSession()
  }
}

export { YouTubeTracker }
