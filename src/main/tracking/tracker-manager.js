const { ActivityStore } = require('../data/activity-store');
const { InputStore } = require('../data/input-store');
const { CallStore } = require('../data/call-store');
const { WindowTracker } = require('./window-tracker');
const { InputTracker } = require('./input-tracker');
const { IdleDetector } = require('./idle-detector');
const { CallDetector } = require('./call-detector');
const { YouTubeTracker } = require('./youtube-tracker');

class TrackerManager {
  constructor(database) {
    this.activityStore = new ActivityStore(database.db);
    this.inputStore = new InputStore(database.db);
    this.callStore = new CallStore(database.db);

    this.windowTracker = new WindowTracker(this.activityStore, this.callStore);
    this.inputTracker = new InputTracker(this.inputStore);
    this.callDetector = new CallDetector(this.callStore);
    this.youtubeTracker = new YouTubeTracker(this.activityStore);

    this.idleDetector = new IdleDetector(
      (idleStartedAt) => this._handleIdleStart(idleStartedAt),
      (idleStartedAt, idleEndedAt) => this._handleIdleEnd(idleStartedAt, idleEndedAt)
    );

    this.isTracking = false;
  }

  start() {
    this.windowTracker.start();
    this.inputTracker.start();
    this.callDetector.start();
    this.idleDetector.start();
    this.youtubeTracker.start();
    this.isTracking = true;
  }

  _handleIdleStart(idleStartedAt) {
    // Don't go idle during calls (native app calls or Google Meet)
    if (this.callDetector.hasActiveCalls() || this.windowTracker.hasActiveGoogleMeet()) {
      return;
    }

    this.windowTracker.pause(idleStartedAt);
    this.inputTracker.flush();
  }

  _handleIdleEnd(idleStartedAt, idleEndedAt) {
    // Record the idle period
    this.activityStore.insert({
      appName: 'Idle',
      windowTitle: '',
      category: 'Idle',
      startedAt: idleStartedAt,
      endedAt: idleEndedAt,
      durationMs: idleEndedAt - idleStartedAt,
      isIdle: true
    });

    this.windowTracker.resume();
  }

  stop() {
    this.windowTracker.stop();
    this.inputTracker.stop();
    this.callDetector.stop();
    this.idleDetector.stop();
    this.youtubeTracker.stop();
    this.isTracking = false;
  }
}

module.exports = { TrackerManager };
