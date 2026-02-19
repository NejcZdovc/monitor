import { powerMonitor } from 'electron'
import {
  IDLE_CHECK_INTERVAL_MS,
  IDLE_RESUME_THRESHOLD_SECONDS,
  IDLE_THRESHOLD_SECONDS,
  ONE_SECOND_MS,
} from '../constants'

class IdleDetector {
  idleThreshold: number
  checkInterval: number
  isIdle: boolean
  idleStartedAt: number | null
  onIdleStart: (idleStartedAt: number) => void
  onIdleEnd: (idleStartedAt: number | null, idleEndedAt: number) => void
  timer: ReturnType<typeof setInterval> | null

  constructor(
    onIdleStart: (idleStartedAt: number) => void,
    onIdleEnd: (idleStartedAt: number | null, idleEndedAt: number) => void,
  ) {
    this.idleThreshold = IDLE_THRESHOLD_SECONDS
    this.checkInterval = IDLE_CHECK_INTERVAL_MS
    this.isIdle = false
    this.idleStartedAt = null
    this.onIdleStart = onIdleStart
    this.onIdleEnd = onIdleEnd
    this.timer = null
  }

  start() {
    this.timer = setInterval(() => this._check(), this.checkInterval)
  }

  _check() {
    const idleSeconds = powerMonitor.getSystemIdleTime()
    if (!this.isIdle && idleSeconds >= this.idleThreshold) {
      this.isIdle = true
      this.idleStartedAt = Date.now() - idleSeconds * ONE_SECOND_MS
      this.onIdleStart(this.idleStartedAt)
    } else if (this.isIdle && idleSeconds < IDLE_RESUME_THRESHOLD_SECONDS) {
      this.isIdle = false
      const endedAt = Date.now()
      this.onIdleEnd(this.idleStartedAt, endedAt)
      this.idleStartedAt = null
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

export { IdleDetector }
