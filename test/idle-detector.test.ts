/**
 * Tests for IdleDetector: threshold detection, retroactive idle start calculation,
 * idle end detection, and callback invocations.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockIdleTime = 0

jest.mock('electron', () => ({
  powerMonitor: {
    getSystemIdleTime: jest.fn(() => mockIdleTime),
  },
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import { IdleDetector } from '../src/main/tracking/idle-detector'

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('IdleDetector', () => {
  let detector: InstanceType<typeof IdleDetector>
  let onIdleStart: jest.Mock
  let onIdleEnd: jest.Mock
  let _realDateNow: () => number
  let currentTime: number

  beforeEach(() => {
    jest.useFakeTimers()
    onIdleStart = jest.fn()
    onIdleEnd = jest.fn()
    detector = new IdleDetector(onIdleStart, onIdleEnd)
    mockIdleTime = 0

    _realDateNow = Date.now
    currentTime = 1705325400000
    Date.now = jest.fn(() => currentTime)
  })

  afterEach(() => {
    Date.now = _realDateNow
    detector.stop()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  // ── Constructor defaults ─────────────────────────────────────────────

  describe('constructor', () => {
    test('sets default idle threshold to 300 seconds', () => {
      expect(detector.idleThreshold).toBe(300)
    })

    test('sets default check interval to 15 seconds', () => {
      expect(detector.checkInterval).toBe(15000)
    })

    test('starts not idle', () => {
      expect(detector.isIdle).toBe(false)
      expect(detector.idleStartedAt).toBeNull()
    })

    test('stores callbacks', () => {
      expect(detector.onIdleStart).toBe(onIdleStart)
      expect(detector.onIdleEnd).toBe(onIdleEnd)
    })
  })

  // ── Idle start detection ─────────────────────────────────────────────

  describe('idle start detection', () => {
    test('triggers onIdleStart when idle time reaches threshold', () => {
      mockIdleTime = 300
      detector._check()

      expect(onIdleStart).toHaveBeenCalledTimes(1)
      expect(detector.isIdle).toBe(true)
    })

    test('triggers onIdleStart when idle time exceeds threshold', () => {
      mockIdleTime = 600
      detector._check()

      expect(onIdleStart).toHaveBeenCalledTimes(1)
    })

    test('does not trigger below threshold', () => {
      mockIdleTime = 299
      detector._check()

      expect(onIdleStart).not.toHaveBeenCalled()
      expect(detector.isIdle).toBe(false)
    })

    test('computes retroactive idle start time', () => {
      mockIdleTime = 300
      detector._check()

      // idleStartedAt = Date.now() - idleSeconds * 1000
      const expectedStart = currentTime - 300 * 1000
      expect(onIdleStart).toHaveBeenCalledWith(expectedStart)
      expect(detector.idleStartedAt).toBe(expectedStart)
    })

    test('computes correct retroactive time for long idle', () => {
      mockIdleTime = 3600 // 1 hour idle
      detector._check()

      const expectedStart = currentTime - 3600 * 1000
      expect(onIdleStart).toHaveBeenCalledWith(expectedStart)
    })

    test('does not trigger idle start twice', () => {
      mockIdleTime = 300
      detector._check()
      detector._check()
      detector._check()

      expect(onIdleStart).toHaveBeenCalledTimes(1)
    })
  })

  // ── Idle end detection ───────────────────────────────────────────────

  describe('idle end detection', () => {
    test('triggers onIdleEnd when idle time drops below 10 seconds', () => {
      // First become idle
      mockIdleTime = 300
      detector._check()
      const idleStartedAt = detector.idleStartedAt

      // Then become active
      currentTime += 60000
      mockIdleTime = 5
      detector._check()

      expect(onIdleEnd).toHaveBeenCalledTimes(1)
      expect(onIdleEnd).toHaveBeenCalledWith(idleStartedAt, currentTime)
      expect(detector.isIdle).toBe(false)
      expect(detector.idleStartedAt).toBeNull()
    })

    test('does not trigger idle end at exactly 10 seconds', () => {
      mockIdleTime = 300
      detector._check()

      mockIdleTime = 10
      detector._check()

      expect(onIdleEnd).not.toHaveBeenCalled()
      expect(detector.isIdle).toBe(true)
    })

    test('triggers idle end at 9 seconds', () => {
      mockIdleTime = 300
      detector._check()

      currentTime += 10000
      mockIdleTime = 9
      detector._check()

      expect(onIdleEnd).toHaveBeenCalledTimes(1)
    })

    test('triggers idle end at 0 seconds', () => {
      mockIdleTime = 300
      detector._check()

      currentTime += 10000
      mockIdleTime = 0
      detector._check()

      expect(onIdleEnd).toHaveBeenCalledTimes(1)
    })

    test('does not trigger idle end when not idle', () => {
      mockIdleTime = 5
      detector._check()

      expect(onIdleEnd).not.toHaveBeenCalled()
    })
  })

  // ── Full idle cycle ──────────────────────────────────────────────────

  describe('full idle cycle', () => {
    test('can go idle, return, and go idle again', () => {
      // Go idle
      mockIdleTime = 300
      detector._check()
      expect(onIdleStart).toHaveBeenCalledTimes(1)

      // Return active
      currentTime += 60000
      mockIdleTime = 2
      detector._check()
      expect(onIdleEnd).toHaveBeenCalledTimes(1)

      // Go idle again
      currentTime += 600000
      mockIdleTime = 400
      detector._check()
      expect(onIdleStart).toHaveBeenCalledTimes(2)

      // Return again
      currentTime += 120000
      mockIdleTime = 1
      detector._check()
      expect(onIdleEnd).toHaveBeenCalledTimes(2)
    })

    test('idle start passes correct timestamp each cycle', () => {
      // First idle
      mockIdleTime = 300
      detector._check()
      expect(onIdleStart).toHaveBeenCalledWith(currentTime - 300000)

      // Return
      currentTime += 60000
      mockIdleTime = 0
      detector._check()

      // Second idle at different time
      currentTime += 1000000
      mockIdleTime = 500
      detector._check()
      expect(onIdleStart).toHaveBeenCalledWith(currentTime - 500000)
    })
  })

  // ── Start / Stop ────────────────────────────────────────────────────

  describe('start and stop', () => {
    test('start creates interval timer', () => {
      detector.start()
      expect(detector.timer).not.toBeNull()
    })

    test('stop clears timer', () => {
      detector.start()
      detector.stop()
      expect(detector.timer).toBeNull()
    })

    test('stop is safe to call without start', () => {
      expect(() => detector.stop()).not.toThrow()
      expect(detector.timer).toBeNull()
    })

    test('interval triggers _check', () => {
      const { powerMonitor } = require('electron')
      detector.start()

      // Fast-forward one interval
      jest.advanceTimersByTime(15000)

      expect(powerMonitor.getSystemIdleTime).toHaveBeenCalled()
    })
  })

  // ── Edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('exactly at threshold boundary (300)', () => {
      mockIdleTime = 300
      detector._check()
      expect(detector.isIdle).toBe(true)
    })

    test('just below threshold (299)', () => {
      mockIdleTime = 299
      detector._check()
      expect(detector.isIdle).toBe(false)
    })

    test('idle time going from high to still-above-threshold does not re-trigger', () => {
      mockIdleTime = 500
      detector._check()
      expect(onIdleStart).toHaveBeenCalledTimes(1)

      // Idle time decreases but still above threshold (shouldn't happen in practice,
      // but tests the state machine)
      mockIdleTime = 50
      detector._check()
      // Since 50 >= 10, stays idle, no end triggered
      expect(onIdleEnd).not.toHaveBeenCalled()
    })
  })
})
