import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { BackgroundEntertainmentStore } from '../data/background-entertainment-store'

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
  store: BackgroundEntertainmentStore
  pollInterval: number
  timer: ReturnType<typeof setInterval> | null
  currentSession: { id: number; startedAt: number } | null
  checking: boolean

  constructor(store: BackgroundEntertainmentStore) {
    this.store = store
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

    // Safety timeout: reset flag even if execFile callback never fires
    const safetyTimer = setTimeout(() => {
      this.checking = false
    }, 10000)

    execFile('osascript', [SCRIPT_PATH], { timeout: 8000 }, (err, stdout) => {
      clearTimeout(safetyTimer)
      this.checking = false
      try {
        const result = !err ? stdout.trim() : ''

        if (result) {
          if (!this.currentSession) {
            const now = Date.now()
            this.currentSession = { id: 0, startedAt: now }
            this.currentSession.id = this.store.insert({
              appName: 'YouTube',
              startedAt: now,
              endedAt: null,
              durationMs: null,
            })
          } else {
            this._splitAtHourBoundary()
          }
        } else if (this.currentSession) {
          this._endSession()
        }
      } catch (_e) {
        // Silently ignore
      }
    })
  }

  _splitAtHourBoundary() {
    if (!this.currentSession) return
    const now = Date.now()
    const currentHour = Math.floor(now / 3600000)
    const sessionHour = Math.floor(this.currentSession.startedAt / 3600000)
    if (currentHour <= sessionHour) return

    for (let h = sessionHour + 1; h <= currentHour; h++) {
      const boundary = h * 3600000
      this.store.update(this.currentSession.id, boundary, this.currentSession.startedAt)
      this.currentSession = { id: 0, startedAt: boundary }
      this.currentSession.id = this.store.insert({
        appName: 'YouTube',
        startedAt: boundary,
        endedAt: null,
        durationMs: null,
      })
    }
  }

  _endSession(endTime?: number) {
    if (!this.currentSession) return
    const now = endTime || Date.now()
    this._splitAtHourBoundary()
    this.store.update(this.currentSession.id, now, this.currentSession.startedAt)
    this.currentSession = null
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this._endSession()
  }
}

export { YouTubeTracker }
