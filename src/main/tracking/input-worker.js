// Worker thread for uiohook-napi input tracking.
// Runs the keyboard/mouse hook off the main Electron thread
// to prevent input lag.
const { parentPort } = require('node:worker_threads')
const { uIOhook } = require('uiohook-napi')

let keyCount = 0
let clickCount = 0

uIOhook.on('keydown', () => {
  keyCount++
})

uIOhook.on('click', () => {
  clickCount++
})

// Parent requests current counts
parentPort.on('message', (msg) => {
  if (msg === 'flush') {
    parentPort.postMessage({ keyCount, clickCount })
    keyCount = 0
    clickCount = 0
  } else if (msg === 'stop') {
    try {
      uIOhook.stop()
    } catch (_e) {
      // May already be stopped
    }
    process.exit(0)
  }
})

uIOhook.start()
