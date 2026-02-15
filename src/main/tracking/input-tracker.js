const { Worker } = require('node:worker_threads')
const path = require('node:path')

class InputTracker {
  constructor(inputStore) {
    this.inputStore = inputStore
    this.flushInterval = 60000
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

      this.worker.on('message', (msg) => {
        this.pendingKeys += msg.keyCount
        this.pendingClicks += msg.clickCount
      })

      this.worker.on('error', (err) => {
        console.error('Input worker error:', err.message)
      })

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn('Input worker exited with code', code)
        }
        this.worker = null
      })
    } catch (err) {
      console.error('Failed to start input worker:', err.message)
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

module.exports = { InputTracker }
