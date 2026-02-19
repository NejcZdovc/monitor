/**
 * Tests for CallDetector: process-based call detection, hour-boundary splitting,
 * and session lifecycle (start, check, stop).
 *
 * We mock execFile to simulate `pgrep` responses and Date.now to control time.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture all pgrep callbacks so we can resolve them manually
const pgrepCallbacks: Array<{
  process: string
  cb: (err: Error | null, stdout: string) => void
}> = []

jest.mock('node:child_process', () => ({
  execFile: jest.fn((_cmd: string, args: string[], _opts: object, cb: (err: Error | null, stdout: string) => void) => {
    pgrepCallbacks.push({ process: args[1], cb })
  }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

interface MockCallStore {
  inserts: Array<{ id: number; [key: string]: unknown }>
  updates: Array<{ id: number; endedAt: number; startedAt: number }>
  insert: jest.Mock
  update: jest.Mock
}

function createMockCallStore(): MockCallStore {
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

/**
 * Resolve all pending pgrep callbacks.
 * @param running Set of process names that pgrep should report as running
 */
function resolvePgrep(running: Set<string>) {
  while (pgrepCallbacks.length > 0) {
    const { process, cb } = pgrepCallbacks.shift()!
    if (running.has(process)) {
      cb(null, '12345\n') // pgrep success: PID found
    } else {
      cb(new Error('exit code 1'), '') // pgrep fail: process not found
    }
  }
}

// ── Import after mocks ──────────────────────────────────────────────────────

import type { CallStore } from '../src/main/data/call-store'
import { CallDetector } from '../src/main/tracking/call-detector'

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('CallDetector', () => {
  let detector: InstanceType<typeof CallDetector>
  let callStore: MockCallStore
  let _realDateNow: () => number
  let currentTime: number

  beforeEach(() => {
    jest.useFakeTimers()
    callStore = createMockCallStore()
    detector = new CallDetector(callStore as unknown as CallStore)
    pgrepCallbacks.length = 0

    // Mock Date.now — start at 14:30 UTC
    _realDateNow = Date.now
    currentTime = 1705325400000 // 2024-01-15 14:30:00 UTC
    Date.now = jest.fn(() => currentTime)
  })

  afterEach(() => {
    Date.now = _realDateNow
    detector.stop()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  // ── Basic call detection ─────────────────────────────────────────────

  describe('basic call detection', () => {
    test('starts a Zoom session when CptHost process is running', () => {
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.inserts[0]).toEqual(
        expect.objectContaining({
          appName: 'Zoom',
          startedAt: currentTime,
          endedAt: null,
          durationMs: null,
        }),
      )
      expect(detector.activeCalls.has('Zoom')).toBe(true)
      expect(detector.activeCalls.get('Zoom')!.isActive()).toBe(true)
    })

    test('starts a Teams session when Teams process is running', () => {
      detector._check()
      resolvePgrep(new Set(['Teams']))

      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.inserts[0].appName).toBe('Microsoft Teams')
      expect(detector.activeCalls.has('Microsoft Teams')).toBe(true)
    })

    test('starts both Zoom and Teams when both are running', () => {
      detector._check()
      resolvePgrep(new Set(['CptHost', 'Teams']))

      expect(callStore.insert).toHaveBeenCalledTimes(2)
      expect(detector.activeCalls.size).toBe(2)
    })

    test('does not create session when no call processes are running', () => {
      detector._check()
      resolvePgrep(new Set())

      expect(callStore.insert).toHaveBeenCalledTimes(0)
      expect(detector.activeCalls.size).toBe(0)
    })

    test('does not re-create session if call is still running', () => {
      // First check: Zoom starts
      detector._check()
      resolvePgrep(new Set(['CptHost']))
      expect(callStore.insert).toHaveBeenCalledTimes(1)

      // Second check: Zoom still running
      currentTime += 15000
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      expect(callStore.insert).toHaveBeenCalledTimes(1) // no new insert
      expect(callStore.update).toHaveBeenCalledTimes(0) // not closed
    })

    test('ends session when process stops running', () => {
      detector._check()
      resolvePgrep(new Set(['CptHost']))
      const startedAt = currentTime

      currentTime += 60000 // 1 minute later
      detector._check()
      resolvePgrep(new Set()) // CptHost no longer running

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0]).toEqual(
        expect.objectContaining({
          id: 1,
          endedAt: currentTime,
          startedAt,
        }),
      )
      expect(detector.activeCalls.has('Zoom')).toBe(false)
    })

    test('ends only the process that stopped, keeps others running', () => {
      // Both start
      detector._check()
      resolvePgrep(new Set(['CptHost', 'Teams']))
      expect(callStore.insert).toHaveBeenCalledTimes(2)

      // Zoom ends, Teams continues
      currentTime += 30000
      detector._check()
      resolvePgrep(new Set(['Teams']))

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0].id).toBe(1) // Zoom session
      expect(detector.activeCalls.has('Zoom')).toBe(false)
      expect(detector.activeCalls.has('Microsoft Teams')).toBe(true)
    })

    test('can restart a call after it ended', () => {
      // Zoom starts
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Zoom ends
      currentTime += 60000
      detector._check()
      resolvePgrep(new Set())

      // Zoom starts again
      currentTime += 120000
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      expect(callStore.insert).toHaveBeenCalledTimes(2) // two separate sessions
      expect(callStore.update).toHaveBeenCalledTimes(1) // first ended
      expect(detector.activeCalls.has('Zoom')).toBe(true)
    })
  })

  // ── Checking guard ────────────────────────────────────────────────────

  describe('checking guard', () => {
    test('prevents concurrent checks', () => {
      const { execFile } = require('node:child_process')
      const callsBefore = execFile.mock.calls.length

      detector._check()
      detector._check() // Should be blocked

      // Only one round of pgrep calls (2 processes = 2 calls)
      expect(execFile.mock.calls.length - callsBefore).toBe(2)
    })

    test('resets checking flag after all callbacks resolve', () => {
      detector._check()
      expect(detector.checking).toBe(true)

      resolvePgrep(new Set())
      expect(detector.checking).toBe(false)
    })
  })

  // ── Hour boundary splitting ──────────────────────────────────────────

  describe('hour boundary splitting', () => {
    test('splits active call session when hour boundary is crossed', () => {
      // Start Zoom at 14:55
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 55 * 60000

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      const originalId = callStore.inserts[0].id
      const originalStart = currentTime

      // Check at 15:02 — crosses 15:00 boundary
      currentTime = hour15 + 2 * 60000
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Original session closed at boundary
      expect(callStore.updates[0]).toEqual(
        expect.objectContaining({
          id: originalId,
          endedAt: hour15,
          startedAt: originalStart,
        }),
      )

      // New session opened at boundary
      expect(callStore.inserts[1]).toEqual(
        expect.objectContaining({
          appName: 'Zoom',
          startedAt: hour15,
          endedAt: null,
        }),
      )

      // activeCalls now points to the new session
      const activeSession = detector.activeCalls.get('Zoom')!
      expect(activeSession.current!.startedAt).toBe(hour15)
    })

    test('splits at multiple hour boundaries for long calls', () => {
      // Start Zoom at 13:30
      const hour13 = Math.floor(currentTime / 3600000) * 3600000 - 3600000
      const hour14 = hour13 + 3600000
      const hour15 = hour14 + 3600000
      const hour16 = hour15 + 3600000
      currentTime = hour13 + 30 * 60000

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Jump to 16:10 — crosses 14:00, 15:00, 16:00
      currentTime = hour16 + 10 * 60000
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // 3 boundaries crossed → 3 updates + 3 new inserts
      expect(callStore.update).toHaveBeenCalledTimes(3)
      expect(callStore.updates[0].endedAt).toBe(hour14)
      expect(callStore.updates[1].endedAt).toBe(hour15)
      expect(callStore.updates[2].endedAt).toBe(hour16)

      // 1 original + 3 splits = 4 inserts total
      expect(callStore.insert).toHaveBeenCalledTimes(4)
      expect(callStore.inserts[1].startedAt).toBe(hour14)
      expect(callStore.inserts[2].startedAt).toBe(hour15)
      expect(callStore.inserts[3].startedAt).toBe(hour16)

      // activeCalls points to the latest session
      const activeSession = detector.activeCalls.get('Zoom')!
      expect(activeSession.current!.startedAt).toBe(hour16)
    })

    test('no split when call stays within same hour', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      currentTime = hour14 + 10 * 60000 // 14:10

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // 20 minutes later, still same hour (14:30)
      currentTime = hour14 + 30 * 60000
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      expect(callStore.insert).toHaveBeenCalledTimes(1) // only original
      expect(callStore.update).toHaveBeenCalledTimes(0) // no splits
    })

    test('splits call that starts exactly on hour boundary', () => {
      // Start at exactly 15:00
      const hour15 = (Math.floor(currentTime / 3600000) + 1) * 3600000
      const hour16 = hour15 + 3600000
      currentTime = hour15

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Check at 16:05
      currentTime = hour16 + 5 * 60000
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Should split at 16:00
      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0].endedAt).toBe(hour16)
      expect(callStore.insert).toHaveBeenCalledTimes(2)
      expect(callStore.inserts[1].startedAt).toBe(hour16)
    })

    test('splits both Zoom and Teams independently at hour boundary', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 50 * 60000 // 14:50

      // Both start
      detector._check()
      resolvePgrep(new Set(['CptHost', 'Teams']))

      expect(callStore.insert).toHaveBeenCalledTimes(2)

      // Cross hour boundary
      currentTime = hour15 + 5 * 60000

      detector._check()
      resolvePgrep(new Set(['CptHost', 'Teams']))

      // Both should be split: 2 updates (close at boundary) + 2 new inserts
      expect(callStore.update).toHaveBeenCalledTimes(2)
      expect(callStore.updates[0].endedAt).toBe(hour15)
      expect(callStore.updates[1].endedAt).toBe(hour15)

      expect(callStore.insert).toHaveBeenCalledTimes(4) // 2 original + 2 splits
    })

    test('split preserves app name correctly', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 55 * 60000

      detector._check()
      resolvePgrep(new Set(['Teams']))

      currentTime = hour15 + 5000
      detector._check()
      resolvePgrep(new Set(['Teams']))

      // All inserts should have Microsoft Teams as app name
      for (const ins of callStore.inserts) {
        expect(ins.appName).toBe('Microsoft Teams')
      }
    })
  })

  // ── Session splitting via SessionLifecycle ──────────────────────────

  describe('session splitting via SessionLifecycle', () => {
    test('splitting does nothing when no active calls', () => {
      // Trigger _check with no active calls — no splitting occurs
      detector._check()
      resolvePgrep(new Set())

      expect(callStore.insert).toHaveBeenCalledTimes(0)
      expect(callStore.update).toHaveBeenCalledTimes(0)
    })

    test('does nothing when current hour equals session hour', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      currentTime = hour14 + 10 * 60000

      // Manually set an active call via SessionLifecycle
      const { SessionLifecycle } = require('../src/main/tracking/session-lifecycle')
      const session = new SessionLifecycle(callStore)
      session.current = { id: 1, appName: 'Zoom', startedAt: currentTime }
      detector.activeCalls.set('Zoom', session)

      // Still in same hour — trigger splitting via _check
      currentTime = hour14 + 30 * 60000
      session.splitAtHourBoundary()

      expect(callStore.insert).toHaveBeenCalledTimes(0)
      expect(callStore.update).toHaveBeenCalledTimes(0)
    })

    test('splits correctly when crossing one hour boundary', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const startTime = hour14 + 45 * 60000

      // Manually set an active call via SessionLifecycle
      const { SessionLifecycle } = require('../src/main/tracking/session-lifecycle')
      const session = new SessionLifecycle(callStore)
      session.current = { id: 1, appName: 'Zoom', startedAt: startTime }
      detector.activeCalls.set('Zoom', session)

      currentTime = hour15 + 10 * 60000
      session.splitAtHourBoundary()

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0]).toEqual(
        expect.objectContaining({
          id: 1,
          endedAt: hour15,
          startedAt: startTime,
        }),
      )
      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.inserts[0].startedAt).toBe(hour15)
      expect(callStore.inserts[0].appName).toBe('Zoom')

      // Session updated to new segment
      const active = detector.activeCalls.get('Zoom')!
      expect(active.current!.startedAt).toBe(hour15)
      expect(active.current!.id).toBe(callStore.inserts[0].id)
    })
  })

  // ── hasActiveCalls ──────────────────────────────────────────────────

  describe('hasActiveCalls', () => {
    test('returns false when no active calls', () => {
      expect(detector.hasActiveCalls()).toBe(false)
    })

    test('returns true when there are active calls', () => {
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      expect(detector.hasActiveCalls()).toBe(true)
    })

    test('returns false after all calls end', () => {
      detector._check()
      resolvePgrep(new Set(['CptHost']))

      currentTime += 60000
      detector._check()
      resolvePgrep(new Set())

      expect(detector.hasActiveCalls()).toBe(false)
    })
  })

  // ── stop() ──────────────────────────────────────────────────────────

  describe('stop', () => {
    test('closes all active calls', () => {
      detector._check()
      resolvePgrep(new Set(['CptHost', 'Teams']))

      currentTime += 30000
      detector.stop()

      expect(callStore.update).toHaveBeenCalledTimes(2)
      expect(detector.activeCalls.size).toBe(0)
    })

    test('stop splits call sessions at hour boundary before closing', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      currentTime = hour14 + 55 * 60000 // 14:55

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      const originalId = callStore.inserts[0].id

      // Stop at 15:10 — should split at 15:00, then close at 15:10
      currentTime = hour15 + 10 * 60000
      detector.stop()

      // Split: close original at 15:00, insert new at 15:00
      // Stop: close new at 15:10
      expect(callStore.update).toHaveBeenCalledTimes(2)
      expect(callStore.updates[0].endedAt).toBe(hour15) // split close
      expect(callStore.updates[0].id).toBe(originalId)
      expect(callStore.updates[1].endedAt).toBe(currentTime) // final close

      expect(callStore.insert).toHaveBeenCalledTimes(2) // original + split
      expect(callStore.inserts[1].startedAt).toBe(hour15)

      expect(detector.activeCalls.size).toBe(0)
    })

    test('stop splits at multiple boundaries before closing', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const hour16 = hour15 + 3600000
      currentTime = hour14 + 50 * 60000 // 14:50

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Stop at 16:05 — crosses 15:00 and 16:00
      currentTime = hour16 + 5 * 60000
      detector.stop()

      // 2 splits + 1 final close = 3 updates
      expect(callStore.update).toHaveBeenCalledTimes(3)
      expect(callStore.updates[0].endedAt).toBe(hour15)
      expect(callStore.updates[1].endedAt).toBe(hour16)
      expect(callStore.updates[2].endedAt).toBe(currentTime) // final close

      // 1 original + 2 splits = 3 inserts
      expect(callStore.insert).toHaveBeenCalledTimes(3)
    })

    test('stop with no active calls does nothing', () => {
      detector.stop()

      expect(callStore.update).toHaveBeenCalledTimes(0)
      expect(callStore.insert).toHaveBeenCalledTimes(0)
    })

    test('stop without crossing hour boundary closes at current time', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      currentTime = hour14 + 10 * 60000 // 14:10

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Stop at 14:20 — same hour, no split needed
      currentTime = hour14 + 20 * 60000
      detector.stop()

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0].endedAt).toBe(currentTime)
      expect(callStore.insert).toHaveBeenCalledTimes(1) // only original
    })

    test('stop clears the timer', () => {
      detector.start()
      expect(detector.timer).not.toBeNull()

      detector.stop()
      expect(detector.timer).toBeNull()
    })
  })

  // ── Segment integrity checks ────────────────────────────────────────

  describe('segment integrity', () => {
    test('all segments have positive duration after multi-hour split', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const hour16 = hour15 + 3600000
      const hour17 = hour16 + 3600000
      currentTime = hour14 + 30 * 60000 // 14:30

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Stop at 17:15 — crosses 15:00, 16:00, 17:00
      currentTime = hour17 + 15 * 60000
      detector.stop()

      // Verify all segments: each update has endedAt > startedAt
      for (const update of callStore.updates) {
        expect(update.endedAt).toBeGreaterThan(update.startedAt)
      }
    })

    test('no segment crosses an hour boundary', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const hour16 = hour15 + 3600000
      currentTime = hour14 + 45 * 60000 // 14:45

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      currentTime = hour16 + 20 * 60000 // 16:20
      detector.stop()

      // Check that each closed segment stays within one hour
      for (const update of callStore.updates) {
        const startHour = Math.floor(update.startedAt / 3600000)
        const endHour = Math.floor((update.endedAt - 1) / 3600000)
        expect(endHour).toBeLessThanOrEqual(startHour)
      }
    })

    test('total duration of all segments equals original call duration', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      currentTime = hour14 + 23 * 60000 // 14:23
      const callStart = currentTime

      detector._check()
      resolvePgrep(new Set(['CptHost']))

      // Stop at multiple hours later
      currentTime = hour14 + 4 * 3600000 + 41 * 60000 // 18:41
      const callEnd = currentTime
      detector.stop()

      // Total duration from all segments
      const totalDuration = callStore.updates.reduce((sum, u) => sum + (u.endedAt - u.startedAt), 0)
      expect(totalDuration).toBe(callEnd - callStart)
    })
  })
})
