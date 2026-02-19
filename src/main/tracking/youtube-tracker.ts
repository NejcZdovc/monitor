import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SAFETY_TIMEOUT_MS, YOUTUBE_OSASCRIPT_TIMEOUT_MS, YOUTUBE_POLL_INTERVAL_MS } from '../constants'
import type { BackgroundEntertainmentStore } from '../data/background-entertainment-store'
import { SessionLifecycle } from './session-lifecycle'

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
  session: SessionLifecycle
  pollInterval: number
  timer: ReturnType<typeof setInterval> | null
  checking: boolean

  constructor(store: BackgroundEntertainmentStore) {
    this.session = new SessionLifecycle(store)
    this.pollInterval = YOUTUBE_POLL_INTERVAL_MS
    this.timer = null
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
    }, SAFETY_TIMEOUT_MS)

    execFile('osascript', [SCRIPT_PATH], { timeout: YOUTUBE_OSASCRIPT_TIMEOUT_MS }, (err, stdout) => {
      clearTimeout(safetyTimer)
      this.checking = false
      try {
        const result = !err ? stdout.trim() : ''

        if (result) {
          if (!this.session.isActive()) {
            this.session.open('YouTube')
          } else {
            this.session.splitAtHourBoundary()
          }
        } else if (this.session.isActive()) {
          this.session.close()
        }
      } catch (_e) {
        // Silently ignore
      }
    })
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.session.close()
  }
}

export { YouTubeTracker }
