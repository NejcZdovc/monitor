import { execFile } from 'node:child_process'
import { CALL_CHECK_INTERVAL_MS, PGREP_TIMEOUT_MS, SAFETY_TIMEOUT_MS } from '../constants'
import type { CallStore } from '../data/call-store'
import { SessionLifecycle } from './session-lifecycle'

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
  activeCalls: Map<string, SessionLifecycle>
  timer: ReturnType<typeof setInterval> | null
  checking: boolean

  constructor(callStore: CallStore) {
    this.callStore = callStore
    this.checkInterval = CALL_CHECK_INTERVAL_MS
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
    for (const session of this.activeCalls.values()) {
      session.splitAtHourBoundary()
    }

    let pending = CALL_PROCESSES.length
    const runningCalls = new Set<string>()

    if (pending === 0) {
      this.checking = false
      return
    }

    // Safety timeout: reset flag even if a pgrep callback never fires
    const safetyTimer = setTimeout(() => {
      this.checking = false
    }, SAFETY_TIMEOUT_MS)

    for (const app of CALL_PROCESSES) {
      execFile('pgrep', ['-x', app.process], { timeout: PGREP_TIMEOUT_MS }, (err) => {
        if (!err) {
          runningCalls.add(app.name)

          if (!this.activeCalls.has(app.name)) {
            const session = new SessionLifecycle(this.callStore)
            session.open(app.name)
            this.activeCalls.set(app.name, session)
          }
        }

        pending--
        if (pending === 0) {
          clearTimeout(safetyTimer)
          // All checks done -- end calls that are no longer running
          for (const [appName, session] of this.activeCalls) {
            if (!runningCalls.has(appName)) {
              session.close()
              this.activeCalls.delete(appName)
            }
          }
          this.checking = false
        }
      })
    }
  }

  hasActiveCalls(): boolean {
    return this.activeCalls.size > 0
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const [, session] of this.activeCalls) {
      session.close()
    }
    this.activeCalls.clear()
  }
}

export { CallDetector }
