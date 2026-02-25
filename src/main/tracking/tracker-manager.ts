import { powerMonitor } from 'electron'
import { ActivityStore } from '../data/activity-store'
import { BackgroundEntertainmentStore } from '../data/background-entertainment-store'
import { CallStore } from '../data/call-store'
import type { AppDatabase } from '../data/database'
import { InputStore } from '../data/input-store'
import { CallDetector } from './call-detector'
import { splitTimeRange } from './hour-split'
import { IdleDetector } from './idle-detector'
import { InputTracker } from './input-tracker'
import { WindowTracker } from './window-tracker'
import { YouTubeTracker } from './youtube-tracker'

class TrackerManager {
  activityStore: ActivityStore
  inputStore: InputStore
  callStore: CallStore
  windowTracker: WindowTracker
  inputTracker: InputTracker
  callDetector: CallDetector
  youtubeTracker: YouTubeTracker
  idleDetector: IdleDetector
  isTracking: boolean
  _resumeHandler: (() => void) | null
  _idleWasPaused: boolean

  constructor(database: AppDatabase) {
    this.activityStore = new ActivityStore(database.db)
    this.inputStore = new InputStore(database.db)
    this.callStore = new CallStore(database.db)
    const bgEntertainmentStore = new BackgroundEntertainmentStore(database.db)

    this.windowTracker = new WindowTracker(this.activityStore, this.callStore)
    this.inputTracker = new InputTracker(this.inputStore)
    this.callDetector = new CallDetector(this.callStore)
    this.youtubeTracker = new YouTubeTracker(bgEntertainmentStore)

    this.idleDetector = new IdleDetector(
      (idleStartedAt: number) => this._handleIdleStart(idleStartedAt),
      (idleStartedAt: number | null, idleEndedAt: number) => this._handleIdleEnd(idleStartedAt, idleEndedAt),
    )

    this.isTracking = false
    this._resumeHandler = null
    this._idleWasPaused = false
  }

  start() {
    this.windowTracker.start()
    this.inputTracker.start()
    this.callDetector.start()
    this.idleDetector.start()
    this.youtubeTracker.start()
    this.isTracking = true

    // Restart trackers after Mac wake from sleep.
    // macOS IOKit event taps become invalid after sleep, so uiohook
    // stops receiving events. Re-creating the worker re-establishes the hook.
    // Window tracker timer can also become unreliable after long sleep.
    this._resumeHandler = () => {
      this.inputTracker.restart()
      this.windowTracker.resume()
    }
    powerMonitor.on('resume', this._resumeHandler)
  }

  _handleIdleStart(idleStartedAt: number) {
    // Don't go idle during calls (native app calls or Google Meet)
    if (this.callDetector.hasActiveCalls() || this.windowTracker.hasActiveGoogleMeet()) {
      this._idleWasPaused = false
      return
    }

    this._idleWasPaused = true
    this.windowTracker.pause(idleStartedAt)
    this.inputTracker.flush()
  }

  _handleIdleEnd(idleStartedAt: number | null, idleEndedAt: number) {
    if (!this._idleWasPaused) return

    // Record the idle period, splitting at each hour boundary
    const segments = splitTimeRange(idleStartedAt!, idleEndedAt)
    for (const seg of segments) {
      this.activityStore.insert({
        appName: 'Idle',
        windowTitle: '',
        category: 'Idle',
        startedAt: seg.startedAt,
        endedAt: seg.endedAt,
        durationMs: seg.durationMs,
        isIdle: true,
      })
    }

    this.windowTracker.resume()
  }

  stop() {
    if (this._resumeHandler) {
      powerMonitor.removeListener('resume', this._resumeHandler)
      this._resumeHandler = null
    }
    this.windowTracker.stop()
    this.inputTracker.stop()
    this.callDetector.stop()
    this.idleDetector.stop()
    this.youtubeTracker.stop()
    this.isTracking = false
  }
}

export { TrackerManager }
