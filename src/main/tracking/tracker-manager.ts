import { ActivityStore } from '../data/activity-store'
import { BackgroundEntertainmentStore } from '../data/background-entertainment-store'
import { CallStore } from '../data/call-store'
import type { AppDatabase } from '../data/database'
import { InputStore } from '../data/input-store'
import { CallDetector } from './call-detector'
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
  }

  start() {
    this.windowTracker.start()
    this.inputTracker.start()
    this.callDetector.start()
    this.idleDetector.start()
    this.youtubeTracker.start()
    this.isTracking = true
  }

  _handleIdleStart(idleStartedAt: number) {
    // Don't go idle during calls (native app calls or Google Meet)
    if (this.callDetector.hasActiveCalls() || this.windowTracker.hasActiveGoogleMeet()) {
      return
    }

    this.windowTracker.pause(idleStartedAt)
    this.inputTracker.flush()
  }

  _handleIdleEnd(idleStartedAt: number | null, idleEndedAt: number) {
    // Record the idle period
    this.activityStore.insert({
      appName: 'Idle',
      windowTitle: '',
      category: 'Idle',
      startedAt: idleStartedAt!,
      endedAt: idleEndedAt,
      durationMs: idleEndedAt - idleStartedAt!,
      isIdle: true,
    })

    this.windowTracker.resume()
  }

  stop() {
    this.windowTracker.stop()
    this.inputTracker.stop()
    this.callDetector.stop()
    this.idleDetector.stop()
    this.youtubeTracker.stop()
    this.isTracking = false
  }
}

export { TrackerManager }
