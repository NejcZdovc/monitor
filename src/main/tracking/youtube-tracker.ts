import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ActivityStore } from '../data/activity-store'

// AppleScript that checks the ACTIVE TAB (first window) of each running browser
// for YouTube. Only tracks YouTube when it is the currently visible tab —
// background tabs are ignored. Only requires Accessibility permission.
const APPLESCRIPT_CONTENT = [
  'tell application "System Events"',
  '  set frontApp to name of first application process whose frontmost is true',
  '  set browserNames to {"Brave Browser Beta", "Google Chrome", "Safari", "Arc", "Brave Browser", "Firefox", "Microsoft Edge", "Vivaldi", "Opera", "Orion", "Chromium", "Zen Browser"}',
  '  repeat with browserName in browserNames',
  '    if exists (application process browserName) then',
  '      if (browserName as text) is not equal to frontApp then',
  '        tell application process browserName',
  '          try',
  '            set winTitle to name of first window',
  '            if winTitle contains "YouTube" then',
  '              return browserName & "|||" & winTitle',
  '            end if',
  '          end try',
  '        end tell',
  '      end if',
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
    this.pollInterval = 10000 // 10s
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
        const result = !err ? stdout.trim() : ''

        if (result && !this.currentSession) {
          const sep = result.indexOf('|||')
          const windowTitle = sep !== -1 ? result.substring(sep + 3) : ''
          const now = Date.now()
          this.currentSession = { id: 0, startedAt: now }
          this.currentSession.id = this.activityStore.insert({
            appName: 'YouTube',
            windowTitle: windowTitle || 'YouTube',
            category: 'Entertainment',
            startedAt: now,
            endedAt: null,
            durationMs: null,
            isIdle: false,
          })
        } else if (!result && this.currentSession) {
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

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this._endSession()
  }
}

export { YouTubeTracker }
