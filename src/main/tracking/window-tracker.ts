import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isFaceTimeCall, isGoogleMeet, resolveBrowserAppName, resolveCategory } from '../categories'
import { OSASCRIPT_TIMEOUT_MS, POLL_SAFETY_TIMEOUT_MS, WINDOW_POLL_INTERVAL_MS } from '../constants'
import type { ActivityStore } from '../data/activity-store'
import type { CallStore } from '../data/call-store'
import type { TrackedSession } from '../types'
import { getHourBoundaries, getHourNumber } from './hour-split'
import { SessionLifecycle } from './session-lifecycle'

// AppleScript to get frontmost app name and window title.
// Only requires Accessibility permission (not Screen Recording).
const APPLESCRIPT_CONTENT = [
  'tell application "System Events"',
  '  set frontApp to first application process whose frontmost is true',
  '  set appName to name of frontApp',
  '  try',
  '    set winTitle to name of first window of frontApp',
  '  on error',
  '    set winTitle to ""',
  '  end try',
  '  return appName & "|||" & winTitle',
  'end tell',
].join('\n')

// Write script to a temp file once (avoids shell quoting issues)
const SCRIPT_PATH = path.join(os.tmpdir(), 'monitor-active-window.scpt')
fs.writeFileSync(SCRIPT_PATH, APPLESCRIPT_CONTENT, 'utf8')

class WindowTracker {
  activityStore: ActivityStore
  callStore: CallStore
  pollInterval: number
  currentSession: TrackedSession | null
  meetSession: SessionLifecycle
  faceTimeSession: SessionLifecycle
  timer: ReturnType<typeof setInterval> | null
  paused: boolean
  polling: boolean
  // Track sessions created by hour-boundary splits so they can be undone
  // when idle detection provides a retroactive end time before the split point
  _splitHistory: Array<{ id: number; startedAt: number }>

  constructor(activityStore: ActivityStore, callStore: CallStore) {
    this.activityStore = activityStore
    this.callStore = callStore
    this.pollInterval = WINDOW_POLL_INTERVAL_MS
    this.currentSession = null
    this.meetSession = new SessionLifecycle(callStore)
    this.faceTimeSession = new SessionLifecycle(callStore)
    this.timer = null
    this.paused = false
    this.polling = false
    this._splitHistory = []
  }

  start() {
    // AppleScript via System Events requires Accessibility permission
    const { systemPreferences } = require('electron')
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      console.warn('Window tracking skipped: Accessibility permission not granted.')
      return
    }

    this.paused = false
    this._poll()
    this.timer = setInterval(() => this._poll(), this.pollInterval)
  }

  _poll() {
    if (this.paused || this.polling) return
    this.polling = true

    // Safety timeout: ensure polling flag is reset even if execFile callback never fires
    const safetyTimer = setTimeout(() => {
      this.polling = false
    }, POLL_SAFETY_TIMEOUT_MS)

    execFile('osascript', [SCRIPT_PATH], { timeout: OSASCRIPT_TIMEOUT_MS }, (err, stdout) => {
      clearTimeout(safetyTimer)
      this.polling = false
      if (this.paused) return

      try {
        if (err) return
        const result = stdout.trim()
        const sep = result.indexOf('|||')
        if (sep === -1) return

        const appName = result.substring(0, sep)
        const windowTitle = result.substring(sep + 3)
        if (!appName) return

        // Skip tracking the Monitor app itself (viewing dashboard shouldn't count as usage)
        if (appName === 'Monitor' || appName === 'Electron') return

        const category = resolveCategory(appName, windowTitle)
        const resolvedApp = resolveBrowserAppName(appName, windowTitle)

        // Split sessions at hour boundaries first, before any close/open logic
        this._splitAtHourBoundary()

        // Track Google Meet and FaceTime as calls
        this._trackGoogleMeet(appName, windowTitle)
        this._trackFaceTime(appName)

        const changed =
          !this.currentSession ||
          this.currentSession.appName !== resolvedApp ||
          this.currentSession.windowTitle !== windowTitle

        if (changed) {
          this._endCurrentSession()
          this._startSession(resolvedApp, windowTitle, category)
        }
      } catch (_e) {
        // Window detection can fail temporarily
      }
    })
  }

  _startSession(appName: string, windowTitle: string, category: string) {
    const now = Date.now()
    this._splitHistory = []
    this.currentSession = {
      id: 0,
      appName,
      windowTitle,
      category,
      startedAt: now,
    }
    this.currentSession.id = this.activityStore.insert({
      appName,
      windowTitle,
      category,
      startedAt: now,
      endedAt: null,
      durationMs: null,
      isIdle: false,
    })
  }

  _endCurrentSession(endTime?: number) {
    if (!this.currentSession) return
    let now = endTime || Date.now()

    // If endTime is before the current session's start (happens when idle detection
    // provides a retroactive timestamp after hour-boundary splits already occurred),
    // undo the splits back to the session that contains the actual end time.
    while (now < this.currentSession.startedAt && this._splitHistory.length > 0) {
      // Delete the session that was created after the real end time
      this.activityStore.delete(this.currentSession.id)
      // Restore the previous split as current (it was already closed at the boundary,
      // so we'll re-close it at the correct end time below)
      const prev = this._splitHistory.pop()!
      this.currentSession = {
        id: prev.id,
        appName: this.currentSession.appName,
        windowTitle: this.currentSession.windowTitle,
        category: this.currentSession.category,
        startedAt: prev.startedAt,
      }
    }

    // If endTime is still before startedAt (idle started before this session),
    // clamp to startedAt so we never produce negative durations
    if (now < this.currentSession.startedAt) {
      now = this.currentSession.startedAt
    }

    this._splitSessionAtHourBoundaries(getHourNumber(now))
    this.activityStore.update(this.currentSession.id, now, this.currentSession.startedAt)
    this.currentSession = null
    this._splitHistory = []
  }

  /**
   * Split the current activity session at every hour boundary between
   * its start hour and `targetHour`.  After this call `currentSession`
   * points to the slice that begins at `targetHour`.
   *
   * Uses getHourBoundaries from hour-split.ts for boundary computation,
   * but keeps the _splitHistory push for the retroactive-idle undo mechanism.
   */
  _splitSessionAtHourBoundaries(targetHour: number) {
    if (!this.currentSession) return
    const boundaries = getHourBoundaries(this.currentSession.startedAt, targetHour)
    if (boundaries.length === 0) return

    const { appName, windowTitle, category } = this.currentSession
    for (const boundary of boundaries) {
      this.activityStore.update(this.currentSession.id, boundary, this.currentSession.startedAt)
      // Record the closed split so it can be undone if idle provides a retroactive end time
      this._splitHistory.push({ id: this.currentSession.id, startedAt: this.currentSession.startedAt })
      this.currentSession = {
        id: 0,
        appName,
        windowTitle,
        category,
        startedAt: boundary,
      }
      this.currentSession.id = this.activityStore.insert({
        appName,
        windowTitle,
        category,
        startedAt: boundary,
        endedAt: null,
        durationMs: null,
        isIdle: false,
      })
    }
  }

  _trackGoogleMeet(appName: string, windowTitle: string) {
    const inMeet = isGoogleMeet(appName, windowTitle)

    if (inMeet && !this.meetSession.isActive()) {
      this.meetSession.open('Google Meet')
    } else if (!inMeet && this.meetSession.isActive()) {
      this.meetSession.close()
    }
  }

  _trackFaceTime(appName: string) {
    const inCall = isFaceTimeCall(appName)

    if (inCall && !this.faceTimeSession.isActive()) {
      this.faceTimeSession.open('FaceTime')
    } else if (!inCall && this.faceTimeSession.isActive()) {
      this.faceTimeSession.close()
    }
  }

  _splitAtHourBoundary() {
    const currentHour = getHourNumber(Date.now())

    // Split activity session at each missed hour boundary
    this._splitSessionAtHourBoundaries(currentHour)

    // Split Google Meet and FaceTime sessions
    this.meetSession.splitAtHourBoundary()
    this.faceTimeSession.splitAtHourBoundary()
  }

  pause(idleStartedAt: number) {
    this.paused = true
    this._endCurrentSession(idleStartedAt)
  }

  resume() {
    this.paused = false
    this.polling = false // Reset in case a timed-out poll left this stuck
    this._poll() // Immediately poll to start tracking right away
  }

  hasActiveGoogleMeet(): boolean {
    return this.meetSession.isActive() || this.faceTimeSession.isActive()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this._endCurrentSession()
    this.meetSession.close()
    this.faceTimeSession.close()
  }
}

export { WindowTracker }
