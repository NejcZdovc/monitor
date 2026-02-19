import { getHourBoundaries, getHourNumber } from './hour-split'

/**
 * The common session shape shared by CallStore and BackgroundEntertainmentStore.
 */
interface SessionData {
  appName: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
}

/**
 * Minimal interface for stores that support session open/close/split.
 * Satisfied by CallStore and BackgroundEntertainmentStore without changes.
 */
interface SessionStore {
  insert(session: SessionData): number
  update(id: number, endedAt: number, startedAt: number): void
}

interface SessionRef {
  id: number
  appName: string
  startedAt: number
}

/**
 * Manages the lifecycle of a single session against a store:
 * open → split at hour boundaries → close.
 *
 * Used by YouTubeTracker (one instance), CallDetector (one per active call),
 * and WindowTracker (for Meet/FaceTime call sub-tracking).
 *
 * Does NOT handle the _splitHistory undo mechanism — that is unique to
 * WindowTracker's activity session tracking.
 */
class SessionLifecycle {
  store: SessionStore
  current: SessionRef | null

  constructor(store: SessionStore) {
    this.store = store
    this.current = null
  }

  /**
   * Open a new session with the given app name.
   */
  open(appName: string) {
    const now = Date.now()
    this.current = { id: 0, appName, startedAt: now }
    this.current.id = this.store.insert({
      appName,
      startedAt: now,
      endedAt: null,
      durationMs: null,
    })
  }

  /**
   * Close the current session. Splits at hour boundaries first.
   */
  close(endTime?: number) {
    if (!this.current) return
    const now = endTime || Date.now()
    this.splitAtHourBoundary(now)
    this.store.update(this.current.id, now, this.current.startedAt)
    this.current = null
  }

  /**
   * Split the current session at hour boundaries up to the given time.
   * Call this on each poll tick to ensure sessions never span multiple hours.
   */
  splitAtHourBoundary(time?: number) {
    if (!this.current) return
    const now = time || Date.now()
    const currentHour = getHourNumber(now)
    const boundaries = getHourBoundaries(this.current.startedAt, currentHour)

    for (const boundary of boundaries) {
      this.store.update(this.current.id, boundary, this.current.startedAt)
      this.current = { id: 0, appName: this.current.appName, startedAt: boundary }
      this.current.id = this.store.insert({
        appName: this.current.appName,
        startedAt: boundary,
        endedAt: null,
        durationMs: null,
      })
    }
  }

  isActive(): boolean {
    return this.current !== null
  }
}

export { SessionLifecycle }
export type { SessionRef, SessionStore }
