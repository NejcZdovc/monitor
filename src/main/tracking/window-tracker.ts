import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isFaceTimeCall, isGoogleMeet, resolveBrowserAppName, resolveCategory } from '../categories'
import type { ActivityStore } from '../data/activity-store'
import type { CallStore } from '../data/call-store'
import type { CallSessionRef, TrackedSession } from '../types'

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
  currentMeetSession: CallSessionRef | null
  currentFaceTimeSession: CallSessionRef | null
  timer: ReturnType<typeof setInterval> | null
  paused: boolean
  polling: boolean

  constructor(activityStore: ActivityStore, callStore: CallStore) {
    this.activityStore = activityStore
    this.callStore = callStore
    this.pollInterval = 5000
    this.currentSession = null
    this.currentMeetSession = null
    this.currentFaceTimeSession = null
    this.timer = null
    this.paused = false
    this.polling = false
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
    }, 5000)

    execFile('osascript', [SCRIPT_PATH], { timeout: 3000 }, (err, stdout) => {
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
    const now = endTime || Date.now()
    this.activityStore.update(this.currentSession.id, now)
    this.currentSession = null
  }

  _trackGoogleMeet(appName: string, windowTitle: string) {
    const inMeet = isGoogleMeet(appName, windowTitle)

    if (inMeet && !this.currentMeetSession) {
      const now = Date.now()
      this.currentMeetSession = { id: 0, appName: 'Google Meet', startedAt: now }
      this.currentMeetSession.id = this.callStore.insert({
        appName: 'Google Meet',
        startedAt: now,
        endedAt: null,
        durationMs: null,
      })
    } else if (!inMeet && this.currentMeetSession) {
      const now = Date.now()
      this.callStore.update(this.currentMeetSession.id, now, this.currentMeetSession.startedAt)
      this.currentMeetSession = null
    }
  }

  _trackFaceTime(appName: string) {
    const inCall = isFaceTimeCall(appName)

    if (inCall && !this.currentFaceTimeSession) {
      const now = Date.now()
      this.currentFaceTimeSession = { id: 0, appName: 'FaceTime', startedAt: now }
      this.currentFaceTimeSession.id = this.callStore.insert({
        appName: 'FaceTime',
        startedAt: now,
        endedAt: null,
        durationMs: null,
      })
    } else if (!inCall && this.currentFaceTimeSession) {
      const now = Date.now()
      this.callStore.update(this.currentFaceTimeSession.id, now, this.currentFaceTimeSession.startedAt)
      this.currentFaceTimeSession = null
    }
  }

  _splitAtHourBoundary() {
    const now = Date.now()
    const currentHour = Math.floor(now / 3600000)

    // Split activity session
    if (this.currentSession) {
      const sessionHour = Math.floor(this.currentSession.startedAt / 3600000)
      if (currentHour !== sessionHour) {
        const hourBoundary = currentHour * 3600000
        const { appName, windowTitle, category } = this.currentSession
        this._endCurrentSession(hourBoundary)
        this._startSession(appName, windowTitle, category)
      }
    }

    // Split Google Meet session
    if (this.currentMeetSession) {
      const sessionHour = Math.floor(this.currentMeetSession.startedAt / 3600000)
      if (currentHour !== sessionHour) {
        const hourBoundary = currentHour * 3600000
        this.callStore.update(this.currentMeetSession.id, hourBoundary, this.currentMeetSession.startedAt)
        this.currentMeetSession = { id: 0, appName: 'Google Meet', startedAt: hourBoundary }
        this.currentMeetSession.id = this.callStore.insert({
          appName: 'Google Meet',
          startedAt: hourBoundary,
          endedAt: null,
          durationMs: null,
        })
      }
    }

    // Split FaceTime session
    if (this.currentFaceTimeSession) {
      const sessionHour = Math.floor(this.currentFaceTimeSession.startedAt / 3600000)
      if (currentHour !== sessionHour) {
        const hourBoundary = currentHour * 3600000
        this.callStore.update(this.currentFaceTimeSession.id, hourBoundary, this.currentFaceTimeSession.startedAt)
        this.currentFaceTimeSession = { id: 0, appName: 'FaceTime', startedAt: hourBoundary }
        this.currentFaceTimeSession.id = this.callStore.insert({
          appName: 'FaceTime',
          startedAt: hourBoundary,
          endedAt: null,
          durationMs: null,
        })
      }
    }
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
    return this.currentMeetSession !== null || this.currentFaceTimeSession !== null
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this._endCurrentSession()
    const now = Date.now()
    if (this.currentMeetSession) {
      this.callStore.update(this.currentMeetSession.id, now, this.currentMeetSession.startedAt)
      this.currentMeetSession = null
    }
    if (this.currentFaceTimeSession) {
      this.callStore.update(this.currentFaceTimeSession.id, now, this.currentFaceTimeSession.startedAt)
      this.currentFaceTimeSession = null
    }
  }
}

export { WindowTracker }
