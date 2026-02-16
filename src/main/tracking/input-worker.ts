import { parentPort } from 'node:worker_threads'
import { uIOhook } from 'uiohook-napi'

let keyCount = 0
let clickCount = 0

uIOhook.on('keydown', () => {
  keyCount++
})
uIOhook.on('click', () => {
  clickCount++
})

parentPort?.on('message', (msg: string) => {
  if (msg === 'flush') {
    parentPort?.postMessage({ keyCount, clickCount })
    keyCount = 0
    clickCount = 0
  } else if (msg === 'stop') {
    try {
      uIOhook.stop()
    } catch (_e) {
      // ignore
    }
    process.exit(0)
  }
})

uIOhook.start()
