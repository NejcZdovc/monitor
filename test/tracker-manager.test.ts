/**
 * Tests for TrackerManager: orchestration of idle detection with window tracking,
 * input flushing, and idle session insertion with hour-boundary splitting.
 *
 * We construct a TrackerManager with all sub-trackers replaced by mocks
 * so we can test the orchestration logic in isolation.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('electron', () => ({
  systemPreferences: { isTrustedAccessibilityClient: jest.fn(() => true) },
  powerMonitor: { getSystemIdleTime: jest.fn(() => 0) },
}))

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}))

jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

interface MockActivityStore {
  sessions: Array<{ id: number; [key: string]: unknown }>
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
}

function createMockActivityStore(): MockActivityStore {
  let nextId = 1
  const sessions: Array<{ id: number; [key: string]: unknown }> = []
  return {
    sessions,
    insert: jest.fn((session: Record<string, unknown>) => {
      const id = nextId++
      sessions.push({ id, ...session })
      return id
    }),
    update: jest.fn(),
    delete: jest.fn(),
  }
}

function createMockWindowTracker() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    hasActiveGoogleMeet: jest.fn(() => false),
  }
}

function createMockInputTracker() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    flush: jest.fn(),
  }
}

function createMockCallDetector() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    hasActiveCalls: jest.fn(() => false),
  }
}

function createMockIdleDetector() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
  }
}

function createMockYouTubeTracker() {
  return {
    start: jest.fn(),
    stop: jest.fn(),
  }
}

// Import the class — we'll manually wire up its internals
import type { ActivityStore } from '../src/main/data/activity-store'
import type { CallDetector } from '../src/main/tracking/call-detector'
import type { IdleDetector } from '../src/main/tracking/idle-detector'
import type { InputTracker } from '../src/main/tracking/input-tracker'
import { TrackerManager } from '../src/main/tracking/tracker-manager'
import type { WindowTracker } from '../src/main/tracking/window-tracker'
import type { YouTubeTracker } from '../src/main/tracking/youtube-tracker'

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('TrackerManager', () => {
  let manager: InstanceType<typeof TrackerManager>
  let activityStore: MockActivityStore
  let windowTracker: ReturnType<typeof createMockWindowTracker>
  let inputTracker: ReturnType<typeof createMockInputTracker>
  let callDetector: ReturnType<typeof createMockCallDetector>
  let idleDetector: ReturnType<typeof createMockIdleDetector>
  let youtubeTracker: ReturnType<typeof createMockYouTubeTracker>
  let _realDateNow: () => number
  let currentTime: number

  beforeEach(() => {
    _realDateNow = Date.now
    currentTime = 1705325400000
    Date.now = jest.fn(() => currentTime)

    activityStore = createMockActivityStore()
    windowTracker = createMockWindowTracker()
    inputTracker = createMockInputTracker()
    callDetector = createMockCallDetector()
    idleDetector = createMockIdleDetector()
    youtubeTracker = createMockYouTubeTracker()

    // Create a TrackerManager with a dummy database, then override internals
    // We can't construct with a real DB, so we use Object.create + manual setup
    manager = Object.create(TrackerManager.prototype)
    manager.activityStore = activityStore as unknown as ActivityStore
    manager.windowTracker = windowTracker as unknown as WindowTracker
    manager.inputTracker = inputTracker as unknown as InputTracker
    manager.callDetector = callDetector as unknown as CallDetector
    manager.idleDetector = idleDetector as unknown as IdleDetector
    manager.youtubeTracker = youtubeTracker as unknown as YouTubeTracker
    manager.isTracking = false
  })

  afterEach(() => {
    Date.now = _realDateNow
  })

  // ── start / stop ────────────────────────────────────────────────────

  describe('start and stop', () => {
    test('start launches all trackers', () => {
      manager.start()

      expect(windowTracker.start).toHaveBeenCalledTimes(1)
      expect(inputTracker.start).toHaveBeenCalledTimes(1)
      expect(callDetector.start).toHaveBeenCalledTimes(1)
      expect(idleDetector.start).toHaveBeenCalledTimes(1)
      expect(youtubeTracker.start).toHaveBeenCalledTimes(1)
      expect(manager.isTracking).toBe(true)
    })

    test('stop stops all trackers', () => {
      manager.isTracking = true
      manager.stop()

      expect(windowTracker.stop).toHaveBeenCalledTimes(1)
      expect(inputTracker.stop).toHaveBeenCalledTimes(1)
      expect(callDetector.stop).toHaveBeenCalledTimes(1)
      expect(idleDetector.stop).toHaveBeenCalledTimes(1)
      expect(youtubeTracker.stop).toHaveBeenCalledTimes(1)
      expect(manager.isTracking).toBe(false)
    })
  })

  // ── _handleIdleStart ────────────────────────────────────────────────

  describe('_handleIdleStart', () => {
    test('pauses window tracker and flushes input', () => {
      const idleStartedAt = currentTime - 300000
      manager._handleIdleStart(idleStartedAt)

      expect(windowTracker.pause).toHaveBeenCalledWith(idleStartedAt)
      expect(inputTracker.flush).toHaveBeenCalledTimes(1)
    })

    test('does not pause when native call is active', () => {
      callDetector.hasActiveCalls.mockReturnValue(true)

      manager._handleIdleStart(currentTime - 300000)

      expect(windowTracker.pause).not.toHaveBeenCalled()
      expect(inputTracker.flush).not.toHaveBeenCalled()
    })

    test('does not pause when Google Meet is active', () => {
      windowTracker.hasActiveGoogleMeet.mockReturnValue(true)

      manager._handleIdleStart(currentTime - 300000)

      expect(windowTracker.pause).not.toHaveBeenCalled()
      expect(inputTracker.flush).not.toHaveBeenCalled()
    })

    test('does not pause when both call and Meet are active', () => {
      callDetector.hasActiveCalls.mockReturnValue(true)
      windowTracker.hasActiveGoogleMeet.mockReturnValue(true)

      manager._handleIdleStart(currentTime - 300000)

      expect(windowTracker.pause).not.toHaveBeenCalled()
    })
  })

  // ── _handleIdleEnd ──────────────────────────────────────────────────

  describe('_handleIdleEnd', () => {
    test('inserts single idle session within one hour', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const idleStart = hour14 + 10 * 60000
      const idleEnd = hour14 + 40 * 60000

      manager._handleIdleEnd(idleStart, idleEnd)

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(activityStore.sessions[0]).toEqual(
        expect.objectContaining({
          appName: 'Idle',
          windowTitle: '',
          category: 'Idle',
          startedAt: idleStart,
          endedAt: idleEnd,
          durationMs: idleEnd - idleStart,
          isIdle: true,
        }),
      )
      expect(windowTracker.resume).toHaveBeenCalledTimes(1)
    })

    test('splits idle session at one hour boundary', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const idleStart = hour14 + 50 * 60000 // 14:50
      const idleEnd = hour15 + 10 * 60000 // 15:10

      manager._handleIdleEnd(idleStart, idleEnd)

      expect(activityStore.insert).toHaveBeenCalledTimes(2)
      // Segment 1: 14:50 → 15:00
      expect(activityStore.sessions[0]).toEqual(
        expect.objectContaining({
          startedAt: idleStart,
          endedAt: hour15,
          durationMs: hour15 - idleStart,
          isIdle: true,
        }),
      )
      // Segment 2: 15:00 → 15:10
      expect(activityStore.sessions[1]).toEqual(
        expect.objectContaining({
          startedAt: hour15,
          endedAt: idleEnd,
          durationMs: idleEnd - hour15,
          isIdle: true,
        }),
      )
    })

    test('splits idle session at multiple hour boundaries (overnight)', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      const hour16 = hour15 + 3600000
      const hour17 = hour16 + 3600000
      const idleStart = hour14 + 45 * 60000 // 14:45
      const idleEnd = hour17 + 15 * 60000 // 17:15

      manager._handleIdleEnd(idleStart, idleEnd)

      // 3 boundaries (15, 16, 17) → 3 splits + 1 final = 4 segments
      expect(activityStore.insert).toHaveBeenCalledTimes(4)
      expect(activityStore.sessions[0].startedAt).toBe(idleStart)
      expect(activityStore.sessions[0].endedAt).toBe(hour15)
      expect(activityStore.sessions[1].startedAt).toBe(hour15)
      expect(activityStore.sessions[1].endedAt).toBe(hour16)
      expect(activityStore.sessions[2].startedAt).toBe(hour16)
      expect(activityStore.sessions[2].endedAt).toBe(hour17)
      expect(activityStore.sessions[3].startedAt).toBe(hour17)
      expect(activityStore.sessions[3].endedAt).toBe(idleEnd)
    })

    test('all idle segments are marked as idle with correct fields', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const hour15 = hour14 + 3600000
      manager._handleIdleEnd(hour14 + 50 * 60000, hour15 + 10 * 60000)

      for (const session of activityStore.sessions) {
        expect(session.appName).toBe('Idle')
        expect(session.windowTitle).toBe('')
        expect(session.category).toBe('Idle')
        expect(session.isIdle).toBe(true)
      }
    })

    test('total duration equals original idle duration', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      const idleStart = hour14 + 23 * 60000
      const idleEnd = hour14 + 5 * 3600000 + 41 * 60000 // 5+ hours later

      manager._handleIdleEnd(idleStart, idleEnd)

      const totalMs = activityStore.sessions.reduce((sum, s) => sum + (s.durationMs as number), 0)
      expect(totalMs).toBe(idleEnd - idleStart)
    })

    test('resumes window tracker after inserting idle sessions', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      manager._handleIdleEnd(hour14 + 10 * 60000, hour14 + 20 * 60000)

      expect(windowTracker.resume).toHaveBeenCalledTimes(1)
    })

    test('handles idle starting exactly on hour boundary', () => {
      const hour15 = (Math.floor(currentTime / 3600000) + 1) * 3600000
      const hour16 = hour15 + 3600000
      const idleStart = hour15
      const idleEnd = hour16 + 30 * 60000

      manager._handleIdleEnd(idleStart, idleEnd)

      expect(activityStore.insert).toHaveBeenCalledTimes(2)
      expect(activityStore.sessions[0].startedAt).toBe(hour15)
      expect(activityStore.sessions[0].endedAt).toBe(hour16)
      expect(activityStore.sessions[1].startedAt).toBe(hour16)
      expect(activityStore.sessions[1].endedAt).toBe(idleEnd)
    })

    test('all segments have positive duration', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      manager._handleIdleEnd(hour14 + 30 * 60000, hour14 + 8.5 * 3600000)

      for (const session of activityStore.sessions) {
        const duration = session.durationMs as number
        expect(duration).toBeGreaterThan(0)
        expect((session.endedAt as number) - (session.startedAt as number)).toBe(duration)
      }
    })

    test('no segment crosses an hour boundary', () => {
      const hour14 = Math.floor(currentTime / 3600000) * 3600000
      manager._handleIdleEnd(hour14 + 45 * 60000, hour14 + 5 * 3600000 + 20 * 60000)

      for (const session of activityStore.sessions) {
        const startHour = Math.floor((session.startedAt as number) / 3600000)
        const endHour = Math.floor(((session.endedAt as number) - 1) / 3600000)
        expect(endHour).toBeLessThanOrEqual(startHour)
      }
    })
  })
})
