import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { INPUT_FLUSH_INTERVAL_MS } from '../constants'
import type { InputStore } from '../data/input-store'

class InputTracker {
  inputStore: InputStore
  flushInterval: number
  timer: ReturnType<typeof setInterval> | null
  worker: Worker | null
  pendingKeys: number
  pendingClicks: number

  constructor(inputStore: InputStore) {
    this.inputStore = inputStore
    this.flushInterval = INPUT_FLUSH_INTERVAL_MS
    this.timer = null
    this.worker = null
    this.pendingKeys = 0
    this.pendingClicks = 0
  }

  start() {
    // uiohook-napi will SIGABRT if Accessibility is not granted
    const { systemPreferences } = require('electron')
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      console.warn('Input tracking skipped: Accessibility permission not granted.')
      return
    }

    try {
      this.worker = new Worker(path.join(__dirname, 'input-worker.js'))

      this.worker.on('message', (msg: { keyCount: number; clickCount: number }) => {
        this.pendingKeys += msg.keyCount
        this.pendingClicks += msg.clickCount
      })

      this.worker.on('error', (err: Error) => {
        console.error('Input worker error:', err.message)
      })

      this.worker.on('exit', (code: number) => {
        if (code !== 0) {
          console.warn('Input worker exited with code', code)
        }
        this.worker = null
      })
    } catch (err: unknown) {
      console.error('Failed to start input worker:', (err as Error).message)
      return
    }

    this.timer = setInterval(() => this.flush(), this.flushInterval)
  }

  flush() {
    // Request counts from worker
    if (this.worker) {
      this.worker.postMessage('flush')
    }

    // Save any accumulated counts from previous flush responses
    // (there's a slight delay but counts are never lost)
    if (this.pendingKeys === 0 && this.pendingClicks === 0) return

    this.inputStore.insert({
      recordedAt: Date.now(),
      keyCount: this.pendingKeys,
      clickCount: this.pendingClicks,
    })

    this.pendingKeys = 0
    this.pendingClicks = 0
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null

    // Final flush
    if (this.worker) {
      this.worker.postMessage('flush')
      // Give worker time to respond before stopping
      setTimeout(() => {
        this.flush()
        if (this.worker) {
          this.worker.postMessage('stop')
        }
      }, 100)
    }
  }
}

export { InputTracker }
