class Dashboard {
  constructor() {
    this.summaryCards = new SummaryCards();
    this.timeRangePicker = new TimeRangePicker((range) => this.onRangeChange(range));
    this.activeTimeChart = new ActiveTimeChart('chart-active-time');
    this.inputChart = new InputChart('chart-input');
    this.appUsageChart = new AppUsageChart('chart-categories', 'chart-apps');
    this.callChart = new CallChart('chart-calls');
    this.youtubeChart = new YouTubeChart('chart-youtube');

    // Tracking toggle
    this.trackingBtn = document.getElementById('tracking-btn');
    this.trackingDot = document.getElementById('tracking-dot');
    this.trackingLabel = document.getElementById('tracking-label');
    this.trackingBtn.addEventListener('click', () => this.toggleTracking());
    this._updateTrackingStatus();

    // Load initial data
    this.onRangeChange(DateUtils.getToday());

    // Auto-refresh every 30 seconds
    this._currentRange = DateUtils.getToday();
    setInterval(() => this.onRangeChange(this._currentRange), 30000);
  }

  async toggleTracking() {
    const result = await window.monitor.toggleTracking();
    this._setTrackingUI(result.isTracking);
  }

  async _updateTrackingStatus() {
    const result = await window.monitor.getTrackingStatus();
    this._setTrackingUI(result.isTracking);
  }

  _setTrackingUI(isTracking) {
    if (isTracking) {
      this.trackingDot.classList.remove('paused');
      this.trackingLabel.textContent = 'Tracking';
    } else {
      this.trackingDot.classList.add('paused');
      this.trackingLabel.textContent = 'Paused';
    }
  }

  async onRangeChange(range) {
    this._currentRange = range;
    const { start, end, type } = range;

    try {
      await Promise.all([
        this.summaryCards.render(start, end),
        this.activeTimeChart.render(start, end, type),
        this.inputChart.render(start, end, type),
        this.appUsageChart.render(start, end),
        this.callChart.render(start, end, type),
        this.youtubeChart.render(start, end, type)
      ]);
    } catch (err) {
      console.error('Failed to render dashboard:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});
