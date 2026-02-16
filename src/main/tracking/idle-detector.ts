import { powerMonitor } from 'electron'

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
    this.idleThreshold = 300
    this.checkInterval = 15000
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
      this.idleStartedAt = Date.now() - idleSeconds * 1000
      this.onIdleStart(this.idleStartedAt)
    } else if (this.isIdle && idleSeconds < 10) {
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
