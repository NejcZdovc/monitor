import { execFile } from 'node:child_process'
import type { CallStore } from '../data/call-store'
import type { CallSessionRef } from '../types'

// CptHost = Zoom's audio process (only runs during active calls)
// Teams = Microsoft Teams app
// Note: avconferenced is NOT used for FaceTime -- it's a system daemon that always runs.
// FaceTime calls are detected by checking if FaceTime is the active window with a call title.
const CALL_PROCESSES = [
  { name: 'Zoom', process: 'CptHost' },
  { name: 'Microsoft Teams', process: 'Teams' },
]

class CallDetector {
  callStore: CallStore
  checkInterval: number
  activeCalls: Map<string, CallSessionRef>
  timer: ReturnType<typeof setInterval> | null
  checking: boolean

  constructor(callStore: CallStore) {
    this.callStore = callStore
    this.checkInterval = 15000
    this.activeCalls = new Map()
    this.timer = null
    this.checking = false
  }

  start() {
    this.timer = setInterval(() => this._check(), this.checkInterval)
  }

  _check() {
    if (this.checking) return
    this.checking = true

    // Split any active call sessions at hour boundaries
    this._splitAtHourBoundary()

    let pending = CALL_PROCESSES.length
    const runningCalls = new Set<string>()

    if (pending === 0) {
      this.checking = false
      return
    }

    // Safety timeout: reset flag even if a pgrep callback never fires
    const safetyTimer = setTimeout(() => {
      this.checking = false
    }, 10000)

    for (const app of CALL_PROCESSES) {
      execFile('pgrep', ['-x', app.process], { timeout: 5000 }, (err) => {
        if (!err) {
          runningCalls.add(app.name)

          if (!this.activeCalls.has(app.name)) {
            const now = Date.now()
            const session: CallSessionRef = { id: 0, appName: app.name, startedAt: now }
            session.id = this.callStore.insert({
              appName: app.name,
              startedAt: now,
              endedAt: null,
              durationMs: null,
            })
            this.activeCalls.set(app.name, session)
          }
        }

        pending--
        if (pending === 0) {
          clearTimeout(safetyTimer)
          // All checks done -- end calls that are no longer running
          for (const [appName, session] of this.activeCalls) {
            if (!runningCalls.has(appName)) {
              const now = Date.now()
              this.callStore.update(session.id, now, session.startedAt)
              this.activeCalls.delete(appName)
            }
          }
          this.checking = false
        }
      })
    }
  }

  _splitAtHourBoundary() {
    const currentHour = Math.floor(Date.now() / 3600000)
    for (const [appName, session] of this.activeCalls) {
      const sessionHour = Math.floor(session.startedAt / 3600000)
      if (currentHour <= sessionHour) continue

      let current = session
      for (let h = sessionHour + 1; h <= currentHour; h++) {
        const boundary = h * 3600000
        this.callStore.update(current.id, boundary, current.startedAt)
        current = { id: 0, appName: current.appName, startedAt: boundary }
        current.id = this.callStore.insert({
          appName: current.appName,
          startedAt: boundary,
          endedAt: null,
          durationMs: null,
        })
      }
      this.activeCalls.set(appName, current)
    }
  }

  hasActiveCalls(): boolean {
    return this.activeCalls.size > 0
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this._splitAtHourBoundary()
    const now = Date.now()
    for (const [, session] of this.activeCalls) {
      this.callStore.update(session.id, now, session.startedAt)
    }
    this.activeCalls.clear()
  }
}

export { CallDetector }
