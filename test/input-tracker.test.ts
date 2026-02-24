/**
 * Tests for InputTracker: worker message handling, flush logic,
 * and stop behavior.
 *
 * We mock Worker to simulate the input-worker thread communication.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockWorkerInstance: MockWorkerType | null = null

interface MockWorkerType {
  on: jest.Mock
  postMessage: jest.Mock
  listeners: Record<string, Array<(...args: unknown[]) => void>>
}

jest.mock('node:worker_threads', () => ({
  Worker: jest.fn().mockImplementation(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    mockWorkerInstance = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = []
        listeners[event].push(handler)
      }),
      postMessage: jest.fn(),
      listeners,
    }
    return mockWorkerInstance
  }),
}))

jest.mock('electron', () => ({
  systemPreferences: {
    isTrustedAccessibilityClient: jest.fn(() => true),
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

interface MockInputStore {
  records: Array<{ recordedAt: number; keyCount: number; clickCount: number }>
  insert: jest.Mock
}

function createMockInputStore(): MockInputStore {
  const records: Array<{ recordedAt: number; keyCount: number; clickCount: number }> = []
  return {
    records,
    insert: jest.fn((record: { recordedAt: number; keyCount: number; clickCount: number }) => {
      records.push(record)
    }),
  }
}

function simulateWorkerMessage(msg: { keyCount: number; clickCount: number }) {
  if (mockWorkerInstance) {
    const handlers = mockWorkerInstance.listeners.message
    if (handlers) {
      for (const handler of handlers) {
        handler(msg)
      }
    }
  }
}

// ── Import after mocks ──────────────────────────────────────────────────────

import type { InputStore } from '../src/main/data/input-store'
import { InputTracker } from '../src/main/tracking/input-tracker'

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('InputTracker', () => {
  let tracker: InstanceType<typeof InputTracker>
  let inputStore: MockInputStore
  let _realDateNow: () => number
  let currentTime: number

  beforeEach(() => {
    jest.useFakeTimers()
    inputStore = createMockInputStore()
    mockWorkerInstance = null

    _realDateNow = Date.now
    currentTime = 1705325400000
    Date.now = jest.fn(() => currentTime)

    tracker = new InputTracker(inputStore as unknown as InputStore)
  })

  afterEach(() => {
    Date.now = _realDateNow
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  // ── Constructor defaults ─────────────────────────────────────────────

  describe('constructor', () => {
    test('sets default flush interval to 60 seconds', () => {
      expect(tracker.flushInterval).toBe(60000)
    })

    test('starts with zero pending counts', () => {
      expect(tracker.pendingKeys).toBe(0)
      expect(tracker.pendingClicks).toBe(0)
    })

    test('starts with no worker and no timer', () => {
      expect(tracker.worker).toBeNull()
      expect(tracker.timer).toBeNull()
    })
  })

  // ── Start ────────────────────────────────────────────────────────────

  describe('start', () => {
    test('creates a worker', () => {
      tracker.start()
      expect(tracker.worker).not.toBeNull()
    })

    test('creates interval timer', () => {
      tracker.start()
      expect(tracker.timer).not.toBeNull()
    })

    test('skips when accessibility is not granted', () => {
      const { systemPreferences } = require('electron')
      systemPreferences.isTrustedAccessibilityClient.mockReturnValueOnce(false)

      tracker.start()

      expect(tracker.worker).toBeNull()
      expect(tracker.timer).toBeNull()
    })

    test('registers message handler on worker', () => {
      tracker.start()
      expect(mockWorkerInstance!.on).toHaveBeenCalledWith('message', expect.any(Function))
    })

    test('registers error handler on worker', () => {
      tracker.start()
      expect(mockWorkerInstance!.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    test('registers exit handler on worker', () => {
      tracker.start()
      expect(mockWorkerInstance!.on).toHaveBeenCalledWith('exit', expect.any(Function))
    })
  })

  // ── Worker message accumulation ──────────────────────────────────────

  describe('worker message accumulation', () => {
    test('accumulates key and click counts from worker messages', () => {
      tracker.start()
      simulateWorkerMessage({ keyCount: 10, clickCount: 3 })

      expect(tracker.pendingKeys).toBe(10)
      expect(tracker.pendingClicks).toBe(3)
    })

    test('accumulates multiple messages', () => {
      tracker.start()
      simulateWorkerMessage({ keyCount: 5, clickCount: 2 })
      simulateWorkerMessage({ keyCount: 8, clickCount: 4 })
      simulateWorkerMessage({ keyCount: 3, clickCount: 1 })

      expect(tracker.pendingKeys).toBe(16)
      expect(tracker.pendingClicks).toBe(7)
    })
  })

  // ── Flush ────────────────────────────────────────────────────────────

  describe('flush', () => {
    test('posts flush message to worker', () => {
      tracker.start()
      tracker.flush()

      expect(mockWorkerInstance!.postMessage).toHaveBeenCalledWith('flush')
    })

    test('does not insert when no pending counts', () => {
      tracker.start()
      tracker.flush()

      expect(inputStore.insert).not.toHaveBeenCalled()
    })

    test('inserts accumulated counts', () => {
      tracker.start()
      simulateWorkerMessage({ keyCount: 20, clickCount: 5 })

      tracker.flush()

      expect(inputStore.insert).toHaveBeenCalledWith({
        recordedAt: currentTime,
        keyCount: 20,
        clickCount: 5,
      })
    })

    test('resets pending counts after flush', () => {
      tracker.start()
      simulateWorkerMessage({ keyCount: 10, clickCount: 3 })

      tracker.flush()

      expect(tracker.pendingKeys).toBe(0)
      expect(tracker.pendingClicks).toBe(0)
    })

    test('successive flushes only insert new accumulations', () => {
      tracker.start()
      simulateWorkerMessage({ keyCount: 10, clickCount: 3 })
      tracker.flush()

      // No new messages — flush should not insert
      tracker.flush()

      expect(inputStore.insert).toHaveBeenCalledTimes(1)

      // New messages arrive
      simulateWorkerMessage({ keyCount: 5, clickCount: 2 })
      tracker.flush()

      expect(inputStore.insert).toHaveBeenCalledTimes(2)
      expect(inputStore.records[1]).toEqual({
        recordedAt: currentTime,
        keyCount: 5,
        clickCount: 2,
      })
    })

    test('flush without worker does not throw', () => {
      // Don't start — no worker
      tracker.pendingKeys = 5
      tracker.pendingClicks = 2
      tracker.flush()

      // Should still insert the accumulated counts
      expect(inputStore.insert).toHaveBeenCalledTimes(1)
    })
  })

  // ── Worker exit ──────────────────────────────────────────────────────

  describe('worker exit', () => {
    test('clears worker reference on exit', () => {
      tracker.start()

      // Simulate worker exit
      const exitHandlers = mockWorkerInstance!.listeners.exit
      for (const handler of exitHandlers) {
        handler(0)
      }

      expect(tracker.worker).toBeNull()
    })
  })

  // ── Restart ─────────────────────────────────────────────────────────

  describe('restart', () => {
    test('creates a new worker', () => {
      tracker.start()
      const firstWorker = mockWorkerInstance

      tracker.restart()

      expect(mockWorkerInstance).not.toBe(firstWorker)
      expect(tracker.worker).not.toBeNull()
    })

    test('sends stop to old worker before creating new one', () => {
      tracker.start()
      const firstWorker = mockWorkerInstance

      tracker.restart()

      expect(firstWorker!.postMessage).toHaveBeenCalledWith('stop')
    })

    test('flushes pending counts before replacing worker', () => {
      tracker.start()
      simulateWorkerMessage({ keyCount: 42, clickCount: 7 })

      tracker.restart()

      expect(inputStore.insert).toHaveBeenCalledWith({
        recordedAt: currentTime,
        keyCount: 42,
        clickCount: 7,
      })
      expect(tracker.pendingKeys).toBe(0)
      expect(tracker.pendingClicks).toBe(0)
    })

    test('skips insert when no pending counts', () => {
      tracker.start()

      tracker.restart()

      expect(inputStore.insert).not.toHaveBeenCalled()
    })

    test('works when worker is already null (previously crashed)', () => {
      tracker.start()
      // Simulate worker crash
      const exitHandlers = mockWorkerInstance!.listeners.exit
      for (const handler of exitHandlers) {
        handler(1)
      }
      expect(tracker.worker).toBeNull()

      tracker.restart()

      expect(tracker.worker).not.toBeNull()
    })

    test('does not create worker if accessibility not granted', () => {
      tracker.start()
      const { systemPreferences } = require('electron')
      systemPreferences.isTrustedAccessibilityClient.mockReturnValueOnce(false)

      tracker.restart()

      expect(tracker.worker).toBeNull()
    })

    test('preserves flush timer across restart', () => {
      tracker.start()
      const timer = tracker.timer

      tracker.restart()

      // Timer should not have been cleared by restart
      expect(tracker.timer).toBe(timer)
    })
  })

  // ── Stop ────────────────────────────────────────────────────────────

  describe('stop', () => {
    test('clears interval timer', () => {
      tracker.start()
      tracker.stop()

      expect(tracker.timer).toBeNull()
    })

    test('posts flush message to worker on stop', () => {
      tracker.start()
      tracker.stop()

      expect(mockWorkerInstance!.postMessage).toHaveBeenCalledWith('flush')
    })
  })
})
