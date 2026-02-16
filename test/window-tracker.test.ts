/**
 * Tests for WindowTracker poll callback logic.
 *
 * We mock execFile to simulate osascript output and Date.now to control time.
 * The tests focus on the callback inside _poll() — the code that runs after
 * execFile returns a result.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock child_process.execFile so we can simulate osascript responses
let execFileCallback: ((err: Error | null, stdout: string) => void) | null = null
jest.mock('node:child_process', () => ({
  execFile: jest.fn((_cmd: string, _args: string[], _opts: object, cb: (err: Error | null, stdout: string) => void) => {
    execFileCallback = cb
  }),
}))

// Mock fs.writeFileSync (module-level side effect writes script file)
jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
}))

// Mock electron (used in start() for accessibility check)
jest.mock('electron', () => ({
  systemPreferences: {
    isTrustedAccessibilityClient: jest.fn(() => true),
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

interface MockActivityStore {
  inserts: Array<{ id: number; [key: string]: unknown }>
  updates: Array<{ id: number; endedAt: number }>
  insert: jest.Mock
  update: jest.Mock
}

interface MockCallStore {
  inserts: Array<{ id: number; [key: string]: unknown }>
  updates: Array<{ id: number; endedAt: number; startedAt: number }>
  insert: jest.Mock
  update: jest.Mock
}

// Create mock stores that record all calls
function createMockActivityStore(): MockActivityStore {
  let nextId = 1
  const inserts: Array<{ id: number; [key: string]: unknown }> = []
  const updates: Array<{ id: number; endedAt: number }> = []
  return {
    inserts,
    updates,
    insert: jest.fn((session: Record<string, unknown>) => {
      const id = nextId++
      inserts.push({ id, ...session })
      return id
    }),
    update: jest.fn((id: number, endedAt: number) => {
      updates.push({ id, endedAt })
    }),
  }
}

function createMockCallStore(): MockCallStore {
  let nextId = 100
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

// Simulate a poll response (what osascript would return)
function simulatePoll(appName: string, windowTitle = '') {
  if (execFileCallback) {
    execFileCallback(null, `${appName}|||${windowTitle}\n`)
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
import { WindowTracker } from '../src/main/tracking/window-tracker'

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('WindowTracker', () => {
  let tracker: InstanceType<typeof WindowTracker>
  let activityStore: MockActivityStore
  let callStore: MockCallStore
  let _realDateNow: () => number
  let currentTime: number

  beforeEach(() => {
    jest.useFakeTimers()
    activityStore = createMockActivityStore()
    callStore = createMockCallStore()
    tracker = new WindowTracker(activityStore, callStore)
    execFileCallback = null

    // Mock Date.now
    _realDateNow = Date.now
    // Default: 2PM on a day (hour 14)
    // 2024-01-15 14:30:00.000 UTC
    currentTime = 1705325400000
    Date.now = jest.fn(() => currentTime)
  })

  afterEach(() => {
    Date.now = _realDateNow
    tracker.stop()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  // ── Basic session tracking ─────────────────────────────────────────────

  describe('basic session tracking', () => {
    /**
     * EXPECTED: First poll creates a new session.
     * - activityStore.insert called with appName='Code', category='Coding'
     * - currentSession is set
     */
    test('creates a session on first poll', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(activityStore.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'Code',
          windowTitle: 'main.js',
          category: 'Coding',
          startedAt: currentTime,
          endedAt: null,
          isIdle: false,
        }),
      )
      expect(tracker.currentSession).not.toBeNull()
      expect(tracker.currentSession?.appName).toBe('Code')
    })

    /**
     * EXPECTED: Same app + same window title = no new session created.
     * - Only 1 insert total after 3 polls
     * - 0 updates (session still open)
     */
    test('does not create a new session when app and window stay the same', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      tracker._poll()
      simulatePoll('Code', 'main.js')

      tracker._poll()
      simulatePoll('Code', 'main.js')

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(activityStore.update).toHaveBeenCalledTimes(0)
    })

    /**
     * EXPECTED: Switching app closes old session and opens new one.
     * - 2 inserts (Code, then Safari)
     * - 1 update (closing Code session)
     */
    test('closes old session and opens new one when app changes', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      currentTime += 10000 // 10s later
      tracker._poll()
      simulatePoll('Safari', 'Google')

      expect(activityStore.insert).toHaveBeenCalledTimes(2)
      expect(activityStore.update).toHaveBeenCalledTimes(1)
      expect(activityStore.updates[0]).toEqual({
        id: 1,
        endedAt: currentTime,
      })
      expect(tracker.currentSession?.appName).toBe('Safari')
    })

    /**
     * EXPECTED: Same app but different window title = new session.
     * - 2 inserts (Code main.js, then Code index.html)
     * - 1 update (closing first session)
     */
    test('creates new session when window title changes', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      currentTime += 5000
      tracker._poll()
      simulatePoll('Code', 'index.html')

      expect(activityStore.insert).toHaveBeenCalledTimes(2)
      expect(activityStore.update).toHaveBeenCalledTimes(1)
      expect(activityStore.inserts[1]).toEqual(expect.objectContaining({ appName: 'Code', windowTitle: 'index.html' }))
    })
  })

  // ── Error and edge cases ───────────────────────────────────────────────

  describe('error and edge cases', () => {
    /**
     * EXPECTED: When osascript errors, no session is created or closed.
     * - 0 inserts, 0 updates
     * - polling flag is reset (so next poll can proceed)
     */
    test('does nothing on osascript error', () => {
      tracker._poll()
      simulateError()

      expect(activityStore.insert).toHaveBeenCalledTimes(0)
      expect(activityStore.update).toHaveBeenCalledTimes(0)
      expect(tracker.polling).toBe(false)
    })

    /**
     * EXPECTED: Existing session remains open when error occurs.
     * - Session from first poll stays untouched
     */
    test('keeps existing session open on error', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      tracker._poll()
      simulateError()

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(activityStore.update).toHaveBeenCalledTimes(0)
      expect(tracker.currentSession?.appName).toBe('Code')
    })

    /**
     * EXPECTED: Empty output (no separator) is ignored.
     */
    test('ignores empty osascript output', () => {
      tracker._poll()
      execFileCallback?.(null, '\n')
      execFileCallback = null

      expect(activityStore.insert).toHaveBeenCalledTimes(0)
    })

    /**
     * EXPECTED: Empty app name (separator at position 0) is ignored.
     */
    test('ignores empty app name', () => {
      tracker._poll()
      execFileCallback?.(null, '|||Some Window\n')
      execFileCallback = null

      expect(activityStore.insert).toHaveBeenCalledTimes(0)
    })

    /**
     * EXPECTED: If paused between execFile call and callback, the callback
     * is ignored.
     */
    test('ignores callback when paused during poll', () => {
      tracker._poll()
      tracker.paused = true
      simulatePoll('Code', 'main.js')

      expect(activityStore.insert).toHaveBeenCalledTimes(0)
    })

    /**
     * EXPECTED: Second poll is blocked while first is in-flight (polling guard).
     */
    test('prevents concurrent polls', () => {
      const { execFile } = require('node:child_process')
      const callsBefore = execFile.mock.calls.length
      tracker._poll()
      tracker._poll() // Should be blocked

      // execFile should only have been called once more
      expect(execFile.mock.calls.length - callsBefore).toBe(1)
    })
  })

  // ── Monitor/Electron self-tracking exclusion ───────────────────────────

  describe('self-tracking exclusion', () => {
    /**
     * EXPECTED: 'Monitor' app is skipped — no session created.
     */
    test('skips Monitor app', () => {
      tracker._poll()
      simulatePoll('Monitor', 'Activity Monitor')

      expect(activityStore.insert).toHaveBeenCalledTimes(0)
      expect(tracker.currentSession).toBeNull()
    })

    /**
     * EXPECTED: 'Electron' app is skipped — no session created.
     */
    test('skips Electron app', () => {
      tracker._poll()
      simulatePoll('Electron', 'Monitor')

      expect(activityStore.insert).toHaveBeenCalledTimes(0)
    })

    /**
     * EXPECTED: Switching to Monitor does NOT close the current session.
     * The current Code session remains open (because the callback returns
     * early before reaching the changed/close logic).
     */
    test('does not close current session when switching to Monitor', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      currentTime += 5000
      tracker._poll()
      simulatePoll('Monitor', 'Activity Monitor')

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(activityStore.update).toHaveBeenCalledTimes(0)
      expect(tracker.currentSession?.appName).toBe('Code')
    })
  })

  // ── Hour boundary splitting ────────────────────────────────────────────

  describe('hour boundary splitting', () => {
    /**
     * EXPECTED: When a poll fires and the hour has changed since session start,
     * the session is closed at the hour boundary and a new one is opened.
     *
     * Timeline:
     *   14:55:00 - Poll 1: Code session starts (id=1, startedAt=14:55)
     *   15:00:05 - Poll 2: Code session continues, but hour changed
     *     -> Close session 1 at 15:00:00 (hour boundary)
     *     -> Open session 2 at 15:00:00 with same app/title/category
     */
    test('splits activity session at hour boundary', () => {
      // 14:55:00 UTC
      currentTime = Math.floor(1705325400000 / 3600000) * 3600000 + 55 * 60000
      tracker._poll()
      simulatePoll('Code', 'main.js')

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      const sessionStartHour = Math.floor(currentTime / 3600000)

      // Advance to 15:00:05 (next hour + 5s)
      const hourBoundary = (sessionStartHour + 1) * 3600000
      currentTime = hourBoundary + 5000

      tracker._poll()
      simulatePoll('Code', 'main.js')

      // Session 1 should be closed at hour boundary
      expect(activityStore.update).toHaveBeenCalledTimes(1)
      expect(activityStore.updates[0]).toEqual({
        id: 1,
        endedAt: hourBoundary,
      })

      // Session 2 should be opened at hour boundary with same app
      expect(activityStore.insert).toHaveBeenCalledTimes(2)
      expect(activityStore.inserts[1]).toEqual(
        expect.objectContaining({
          appName: 'Code',
          windowTitle: 'main.js',
          category: 'Coding',
        }),
      )

      // No extra update since app didn't change (Code -> Code)
      expect(activityStore.update).toHaveBeenCalledTimes(1)
    })

    /**
     * EXPECTED: Hour boundary + app change in same poll.
     * The split happens first, then the app change is detected.
     *
     * Timeline:
     *   14:55:00 - Poll 1: Code session starts
     *   15:00:05 - Poll 2: Now using Safari
     *     -> Split: Close Code session at 15:00:00, reopen Code at 15:00:00
     *     -> Change: Close Code session (at current time), open Safari session
     *
     * Result: 3 inserts (Code@14:55, Code@15:00, Safari@15:00:05)
     *         2 updates (close Code@14:55 at 15:00, close Code@15:00 at 15:00:05)
     */
    test('hour boundary split + app change in same poll', () => {
      currentTime = Math.floor(1705325400000 / 3600000) * 3600000 + 55 * 60000
      tracker._poll()
      simulatePoll('Code', 'main.js')

      const sessionStartHour = Math.floor(currentTime / 3600000)
      const hourBoundary = (sessionStartHour + 1) * 3600000
      currentTime = hourBoundary + 5000

      tracker._poll()
      simulatePoll('Safari', 'Google')

      // 3 inserts: Code@14:55, Code@15:00 (from split), Safari@15:00:05
      expect(activityStore.insert).toHaveBeenCalledTimes(3)
      expect(activityStore.inserts[0].appName).toBe('Code')
      expect(activityStore.inserts[1].appName).toBe('Code')
      expect(activityStore.inserts[2].appName).toBe('Safari')

      // 2 updates: close Code#1 at boundary, close Code#2 at current time
      expect(activityStore.update).toHaveBeenCalledTimes(2)
      expect(activityStore.updates[0].endedAt).toBe(hourBoundary)
      expect(activityStore.updates[1].endedAt).toBe(currentTime)
    })

    /**
     * EXPECTED: No split when staying in the same hour.
     */
    test('no split when time stays within same hour', () => {
      currentTime = Math.floor(1705325400000 / 3600000) * 3600000 + 10 * 60000
      tracker._poll()
      simulatePoll('Code', 'main.js')

      // 20 minutes later, still same hour
      currentTime += 20 * 60000
      tracker._poll()
      simulatePoll('Code', 'main.js')

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(activityStore.update).toHaveBeenCalledTimes(0)
    })

    /**
     * EXPECTED: Multiple hour boundaries crossed (e.g. laptop was sleeping).
     * Only one split happens (at the current hour boundary), not multiple.
     * This is correct because we only care about the current hour.
     */
    test('handles multiple hour boundaries crossed (sleep/wake)', () => {
      currentTime = Math.floor(1705325400000 / 3600000) * 3600000 + 30 * 60000
      tracker._poll()
      simulatePoll('Code', 'main.js')

      // Jump 3 hours forward (as if laptop was asleep)
      const sessionStartHour = Math.floor(currentTime / 3600000)
      currentTime = (sessionStartHour + 3) * 3600000 + 10 * 60000

      tracker._poll()
      simulatePoll('Code', 'main.js')

      // Should close at the current hour boundary and reopen
      const currentHourBoundary = Math.floor(currentTime / 3600000) * 3600000
      expect(activityStore.update).toHaveBeenCalledTimes(1)
      expect(activityStore.updates[0].endedAt).toBe(currentHourBoundary)
      expect(activityStore.insert).toHaveBeenCalledTimes(2)
    })
  })

  // ── Google Meet call tracking ──────────────────────────────────────────

  describe('Google Meet call tracking', () => {
    /**
     * EXPECTED: Navigating to Google Meet in a browser starts a call session.
     */
    test('starts Meet session when window title contains Google Meet', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - abc-defg-hij')

      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.inserts[0]).toEqual(
        expect.objectContaining({
          appName: 'Google Meet',
          startedAt: currentTime,
          endedAt: null,
        }),
      )
      expect(tracker.currentMeetSession).not.toBeNull()
    })

    /**
     * EXPECTED: Leaving Google Meet closes the call session.
     */
    test('closes Meet session when leaving Meet', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      currentTime += 60000
      tracker._poll()
      simulatePoll('Google Chrome', 'Gmail - Inbox')

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0]).toEqual(
        expect.objectContaining({
          id: 100,
          endedAt: currentTime,
        }),
      )
      expect(tracker.currentMeetSession).toBeNull()
    })

    /**
     * EXPECTED: Meet session is split at hour boundary.
     */
    test('splits Meet session at hour boundary', () => {
      currentTime = Math.floor(1705325400000 / 3600000) * 3600000 + 55 * 60000
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      const hourBoundary = (Math.floor(currentTime / 3600000) + 1) * 3600000
      currentTime = hourBoundary + 5000

      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      // Old Meet session closed at boundary
      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0].endedAt).toBe(hourBoundary)

      // New Meet session opened at boundary
      expect(callStore.insert).toHaveBeenCalledTimes(2)
      expect(callStore.inserts[1]).toEqual(
        expect.objectContaining({
          appName: 'Google Meet',
          startedAt: hourBoundary,
        }),
      )
    })

    /**
     * EXPECTED: Staying in same Meet session without hour change = no extra inserts.
     */
    test('does not re-create Meet session on same-hour polls', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      currentTime += 30000
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.update).toHaveBeenCalledTimes(0)
    })
  })

  // ── FaceTime call tracking ─────────────────────────────────────────────

  describe('FaceTime call tracking', () => {
    /**
     * EXPECTED: FaceTime app starts a call session.
     */
    test('starts FaceTime session', () => {
      tracker._poll()
      simulatePoll('FaceTime', 'Call with John')

      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.inserts[0].appName).toBe('FaceTime')
      expect(tracker.currentFaceTimeSession).not.toBeNull()
    })

    /**
     * EXPECTED: Switching away from FaceTime closes the call session.
     */
    test('closes FaceTime session when switching app', () => {
      tracker._poll()
      simulatePoll('FaceTime', 'Call with John')

      currentTime += 30000
      tracker._poll()
      simulatePoll('Safari', 'Google')

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0].id).toBe(100)
      expect(tracker.currentFaceTimeSession).toBeNull()
    })

    /**
     * EXPECTED: FaceTime session is split at hour boundary.
     */
    test('splits FaceTime session at hour boundary', () => {
      currentTime = Math.floor(1705325400000 / 3600000) * 3600000 + 58 * 60000
      tracker._poll()
      simulatePoll('FaceTime', 'Call')

      const hourBoundary = (Math.floor(currentTime / 3600000) + 1) * 3600000
      currentTime = hourBoundary + 5000

      tracker._poll()
      simulatePoll('FaceTime', 'Call')

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(callStore.updates[0].endedAt).toBe(hourBoundary)
      expect(callStore.insert).toHaveBeenCalledTimes(2)
      expect(callStore.inserts[1].startedAt).toBe(hourBoundary)
    })
  })

  // ── Pause / Resume ────────────────────────────────────────────────────

  describe('pause and resume', () => {
    /**
     * EXPECTED: Pausing closes the current session at the idle start time.
     */
    test('pause closes current session', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      const idleStart = currentTime + 5000
      tracker.pause(idleStart)

      expect(activityStore.update).toHaveBeenCalledTimes(1)
      expect(activityStore.updates[0].endedAt).toBe(idleStart)
      expect(tracker.currentSession).toBeNull()
      expect(tracker.paused).toBe(true)
    })

    /**
     * EXPECTED: Resume resets polling flag and triggers immediate poll.
     */
    test('resume resets polling and triggers poll', () => {
      const { execFile } = require('node:child_process')
      tracker.paused = true
      tracker.polling = true // Simulate stuck polling

      tracker.resume()

      expect(tracker.paused).toBe(false)
      expect(tracker.polling).toBe(true) // Set to true by _poll
      expect(execFile).toHaveBeenCalled()
    })

    /**
     * EXPECTED: No poll fires while paused.
     */
    test('polls are skipped while paused', () => {
      tracker.paused = true
      tracker._poll()

      expect(execFileCallback).toBeNull()
    })
  })

  // ── Stop ──────────────────────────────────────────────────────────────

  describe('stop', () => {
    /**
     * EXPECTED: stop() closes all open sessions (activity + calls).
     */
    test('closes all open sessions on stop', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      // We now have: activity session + Meet session
      currentTime += 10000
      tracker.stop()

      // Activity session closed
      expect(activityStore.update).toHaveBeenCalledTimes(1)
      // Meet session closed
      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(tracker.currentSession).toBeNull()
      expect(tracker.currentMeetSession).toBeNull()
    })

    /**
     * EXPECTED: stop() with FaceTime also closes FaceTime session.
     */
    test('closes FaceTime session on stop', () => {
      tracker._poll()
      simulatePoll('FaceTime', 'Call')

      currentTime += 5000
      tracker.stop()

      expect(callStore.update).toHaveBeenCalledTimes(1)
      expect(tracker.currentFaceTimeSession).toBeNull()
    })
  })

  // ── Category resolution ───────────────────────────────────────────────

  describe('category resolution', () => {
    /**
     * EXPECTED: Known apps get correct categories.
     */
    test('assigns correct category for coding apps', () => {
      tracker._poll()
      simulatePoll('Code', 'main.js')

      expect(activityStore.inserts[0].category).toBe('Coding')
    })

    test('assigns correct category for browsers', () => {
      tracker._poll()
      simulatePoll('Safari', 'Apple')

      expect(activityStore.inserts[0].category).toBe('Browsers')
    })

    test('assigns AI category for YouTube in browser -> Entertainment', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'YouTube - Funny Video')

      expect(activityStore.inserts[0].category).toBe('Entertainment')
    })

    test('assigns AI category for Claude in browser', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Claude - Chat')

      expect(activityStore.inserts[0].category).toBe('AI')
    })

    test('assigns Meetings category for Google Meet in browser', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - abc-def')

      expect(activityStore.inserts[0].category).toBe('Meetings')
    })

    test('assigns Other for unknown apps', () => {
      tracker._poll()
      simulatePoll('SomeRandomApp', 'Window')

      expect(activityStore.inserts[0].category).toBe('Other')
    })
  })

  // ── Rapid app switching ───────────────────────────────────────────────

  describe('rapid app switching', () => {
    /**
     * EXPECTED: Switching through 4 apps creates 4 sessions and closes 3.
     */
    test('handles rapid switching between multiple apps', () => {
      const apps: Array<[string, string]> = [
        ['Code', 'main.js'],
        ['Safari', 'Google'],
        ['Slack', 'general'],
        ['Code', 'index.html'],
      ]

      for (const [app, title] of apps) {
        currentTime += 2000
        tracker._poll()
        simulatePoll(app, title)
      }

      expect(activityStore.insert).toHaveBeenCalledTimes(4)
      expect(activityStore.update).toHaveBeenCalledTimes(3) // 3 sessions closed
    })
  })

  // ── Browser YouTube title detection ────────────────────────────────────

  describe('browser YouTube detection', () => {
    /**
     * EXPECTED: YouTube in browser title is categorized as Entertainment,
     * and the app_name stays as the browser, not "YouTube".
     */
    test('tracks YouTube as the browser app name, not YouTube', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'YouTube - How to Code')

      expect(activityStore.inserts[0].appName).toBe('Google Chrome')
      expect(activityStore.inserts[0].category).toBe('Entertainment')
    })
  })

  // ── Simultaneous activity + call sessions ─────────────────────────────

  describe('simultaneous activity and call sessions', () => {
    /**
     * EXPECTED: Meet creates both an activity session and a call session.
     * Switching to another app closes the activity session but NOT the call
     * if the new app is also in Meet (it would close if leaving Meet).
     */
    test('Meet creates both activity and call sessions', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      expect(activityStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.insert).toHaveBeenCalledTimes(1)
    })

    /**
     * EXPECTED: Switching from Meet tab to another Chrome tab closes the
     * Meet call session but keeps the activity session chain going.
     */
    test('leaving Meet tab closes call but opens new activity session', () => {
      tracker._poll()
      simulatePoll('Google Chrome', 'Google Meet - call')

      currentTime += 10000
      tracker._poll()
      simulatePoll('Google Chrome', 'Gmail - Inbox')

      // Activity: 2 inserts (Meet page, Gmail page), 1 update (close Meet page)
      expect(activityStore.insert).toHaveBeenCalledTimes(2)
      expect(activityStore.update).toHaveBeenCalledTimes(1)

      // Call: 1 insert (started), 1 update (closed)
      expect(callStore.insert).toHaveBeenCalledTimes(1)
      expect(callStore.update).toHaveBeenCalledTimes(1)
    })
  })
})
