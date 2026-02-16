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

    let pending = CALL_PROCESSES.length
    const runningCalls = new Set<string>()

    if (pending === 0) {
      this.checking = false
      return
    }

    for (const app of CALL_PROCESSES) {
      execFile('pgrep', ['-x', app.process], (err) => {
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

  hasActiveCalls(): boolean {
    return this.activeCalls.size > 0
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const now = Date.now()
    for (const [, session] of this.activeCalls) {
      this.callStore.update(session.id, now, session.startedAt)
    }
    this.activeCalls.clear()
  }
}

export { CallDetector }
