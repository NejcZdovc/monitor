/**
 * Tests for YouTubeTracker: background YouTube detection via AppleScript,
 * session lifecycle, hour-boundary splitting, and stop behavior.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

let execFileCallback: ((err: Error | null, stdout: string) => void) | null = null

jest.mock('node:child_process', () => ({
  execFile: jest.fn(
    (_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, stdout: string) => void) => {
      execFileCallback = cb
    },
  ),
}))

jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

interface MockBgStore {
  inserts: Array<{ id: number; [key: string]: unknown }>
  updates: Array<{ id: number; endedAt: number; startedAt: number }>
  insert: jest.Mock
  update: jest.Mock
}

function createMockBgStore(): MockBgStore {
  let nextId = 1
  const inserts: Array<{ id: number; [key: string]: unknown }> = []
  const updates: Array<{ id: number; endedAt: number; startedAt: number }> = []
  return {
    inserts,
    updates,
    insert: jest.fn((session: Record<string, unknown>) => {
      const id = nextId++
      inserts.push({ id, ...session })
      return id
    }),
    update: jest.fn((id: number, endedAt: number, startedAt: number) => {
      updates.push({ id, endedAt, startedAt })
    }),
  }
}

function simulateYouTubeDetected(browser = 'Google Chrome', title = 'YouTube - Music') {
  if (execFileCallback) {
    execFileCallback(null, `${browser}|||${title}\n`)
    execFileCallback = null
  }
}

function simulateNoYouTube() {
  if (execFileCallback) {
    execFileCallback(null, '\n')
    execFileCallback = null
  }
}

function simulateError() {
  if (execFileCallback) {
    execFileCallback(new Error('osascript failed'), '')
    execFileCallback = null
  }
}

// ── Import after mocks ──────────────────────────────────────────────────────

import { YouTubeTracker } from '../src/main/tracking/youtube-tracker'

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('YouTubeTracker', () => {
  let tracker: InstanceType<typeof YouTubeTracker>
  let store: MockBgStore
  let _realDateNow: () => number
  let currentTime: number

  beforeEach(() => {
    jest.useFakeTimers()
    store = createMockBgStore()
    tracker = new YouTubeTracker(store)
    execFileCallback = null

    _realDateNow = Date.now
    currentTime = 1705325400000
    Date.now = jest.fn(() => currentTime)
  })

  afterEach(() => {
    Date.now = _realDateNow
    tracker.stop()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  // ── Basic session tracking ──────────────────────────────────────────

  describe('basic session tracking', () => {
    test('starts a session when YouTube is detected in background', () => {
      tracker._poll()
      simulateYouTubeDetected()

      expect(store.insert).toHaveBeenCalledTimes(1)
      expect(store.inserts[0]).toEqual(
        expect.objectContaining({
          appName: 'YouTube',
          startedAt: currentTime,
          endedAt: null,
          durationMs: null,
        }),
      )
      expect(tracker.currentSession).not.toBeNull()
    })

    test('does not create session when YouTube is not detected', () => {
      tracker._poll()
      simulateNoYouTube()

      expect(store.insert).not.toHaveBeenCalled()
      expect(tracker.currentSession).toBeNull()
    })

    test('does not re-create session on subsequent detections', () => {
      tracker._poll()
      simulateYouTubeDetected()

      currentTime += 10000
      tracker._poll()
      simulateYouTubeDetected()

      expect(store.insert).toHaveBeenCalledTimes(1)
    })

    test('ends session when YouTube is no longer detected', () => {
      tracker._poll()
      simulateYouTubeDetected()

      currentTime += 30000
      tracker._poll()
      simulateNoYouTube()

      expect(store.update).toHaveBeenCalledTimes(1)
      expect(store.updates[0]).toEqual(
        expect.objectContaining({
          id: 1,
          endedAt: currentTime,
        }),
      )
      expect(tracker.currentSession).toBeNull()
    })

    test('can start a new session after one ends', () => {
      // First session
      tracker._poll()
      simulateYouTubeDetected()

      currentTime += 60000
      tracker._poll()
      simulateNoYouTube()

      // Second session
      currentTime += 120000
      tracker._poll()
      simulateYouTubeDetected()

      expect(store.insert).toHaveBeenCalledTimes(2)
      expect(store.update).toHaveBeenCalledTimes(1)
    })
  })

  // ── Error handling ──────────────────────────────────────────────────

  describe('error handling', () => {
    test('treats error as no YouTube detected', () => {
      tracker._poll()
      simulateError()

      expect(store.insert).not.toHaveBeenCalled()
      expect(tracker.currentSession).toBeNull()
    })

    test('ends session on error if one is active', () => {
      tracker._poll()
      simulateYouTubeDetected()

      currentTime += 10000
      tracker._poll()
      simulateError()

      expect(store.update).toHaveBeenCalledTimes(1)
      expect(tracker.currentSession).toBeNull()
    })
  })

  // ── Checking guard ──────────────────────────────────────────────────

  describe('checking guard', () => {
    test('prevents concurrent polls', () => {
      const { execFile } = require('node:child_process')
      const callsBefore = execFile.mock.calls.length

      tracker._poll()
      tracker._poll() // Should be blocked

      expect(execFile.mock.calls.length - callsBefore).toBe(1)
    })

    test('resets checking flag after callback', () => {
      tracker._poll()
      expect(tracker.checking).toBe(true)

      simulateNoYouTube()
      expect(tracker.checking).toBe(false)
    })
  })

  // ── Hour boundary splitting ──────────────────────────────────────────

  describe('hour boundary splitting', () => {
    test('splits session at hour boundary on subsequent poll', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 55 * 60000 // 14:55

      tracker._poll()
      simulateYouTubeDetected()

      // Next poll at 15:02 — crosses 15:00 boundary
      currentTime = hour15 + 2 * 60000
      tracker._poll()
      simulateYouTubeDetected()

      // Session split: original closed at boundary, new starts at boundary
      expect(store.update).toHaveBeenCalledTimes(1)
      expect(store.updates[0].endedAt).toBe(hour15)
      expect(store.insert).toHaveBeenCalledTimes(2)
      expect(store.inserts[1].startedAt).toBe(hour15)
    })

    test('splits at multiple boundaries for long session', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const hour16 = hour15 + 3600000
      const hour17 = hour16 + 3600000
      currentTime = hour14 + 30 * 60000 // 14:30

      tracker._poll()
      simulateYouTubeDetected()

      // Jump to 17:10 — crosses 15:00, 16:00, 17:00
      currentTime = hour17 + 10 * 60000
      tracker._poll()
      simulateYouTubeDetected()

      expect(store.update).toHaveBeenCalledTimes(3) // 3 boundary splits
      expect(store.insert).toHaveBeenCalledTimes(4) // 1 original + 3 splits
    })

    test('no split when staying within same hour', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      currentTime = hour14 + 10 * 60000

      tracker._poll()
      simulateYouTubeDetected()

      currentTime = hour14 + 30 * 60000
      tracker._poll()
      simulateYouTubeDetected()

      expect(store.update).not.toHaveBeenCalled()
      expect(store.insert).toHaveBeenCalledTimes(1)
    })

    test('splits before ending session when crossing boundary', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 58 * 60000 // 14:58

      tracker._poll()
      simulateYouTubeDetected()

      // YouTube disappears at 15:03
      currentTime = hour15 + 3 * 60000
      tracker._poll()
      simulateNoYouTube()

      // Should split at 15:00 and then close at 15:03
      expect(store.update).toHaveBeenCalledTimes(2) // boundary + end
      expect(store.updates[0].endedAt).toBe(hour15)
      expect(store.updates[1].endedAt).toBe(currentTime)
      expect(store.insert).toHaveBeenCalledTimes(2) // original + split
    })
  })

  // ── _splitAtHourBoundary directly ────────────────────────────────────

  describe('_splitAtHourBoundary', () => {
    test('does nothing when no current session', () => {
      tracker._splitAtHourBoundary()
      expect(store.insert).not.toHaveBeenCalled()
      expect(store.update).not.toHaveBeenCalled()
    })

    test('does nothing when still in same hour', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      currentTime = hour14 + 10 * 60000
      tracker.currentSession = { id: 1, startedAt: currentTime }

      currentTime = hour14 + 30 * 60000
      tracker._splitAtHourBoundary()

      expect(store.insert).not.toHaveBeenCalled()
    })
  })

  // ── Stop ────────────────────────────────────────────────────────────

  describe('stop', () => {
    test('closes active session on stop', () => {
      tracker._poll()
      simulateYouTubeDetected()

      currentTime += 30000
      tracker.stop()

      expect(store.update).toHaveBeenCalledTimes(1)
      expect(store.updates[0].endedAt).toBe(currentTime)
      expect(tracker.currentSession).toBeNull()
    })

    test('stop splits at hour boundary before closing', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 55 * 60000

      tracker._poll()
      simulateYouTubeDetected()

      // Stop at 15:05
      currentTime = hour15 + 5 * 60000
      tracker.stop()

      expect(store.update).toHaveBeenCalledTimes(2) // boundary + final
      expect(store.updates[0].endedAt).toBe(hour15)
      expect(store.updates[1].endedAt).toBe(currentTime)
    })

    test('stop with no active session does nothing', () => {
      tracker.stop()
      expect(store.update).not.toHaveBeenCalled()
    })

    test('stop clears timer', () => {
      tracker.start()
      expect(tracker.timer).not.toBeNull()

      tracker.stop()
      expect(tracker.timer).toBeNull()
    })
  })

  // ── Start ────────────────────────────────────────────────────────────

  describe('start', () => {
    test('triggers immediate poll', () => {
      const { execFile } = require('node:child_process')
      const callsBefore = execFile.mock.calls.length

      tracker.start()

      expect(execFile.mock.calls.length - callsBefore).toBe(1)
    })

    test('creates interval timer', () => {
      tracker.start()
      expect(tracker.timer).not.toBeNull()
    })
  })
})
