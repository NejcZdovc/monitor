import './chart-setup'
import { ActiveTimeChart } from './components/active-time-chart'
import { AiChart } from './components/ai-chart'
import { AppUsageChart } from './components/app-usage-chart'
import { CallChart } from './components/call-chart'
import { CategoryDetail } from './components/category-detail'
import { EntertainmentChart } from './components/entertainment-chart'
import { InputChart } from './components/input-chart'
import { ProjectChart } from './components/project-chart'
import { SummaryCards } from './components/summary-cards'
import { TimeRangePicker } from './components/time-range-picker'
import { getThisMonth, getThisWeek, getToday, type TimeRange } from './date-utils'

class Dashboard {
  summaryCards: SummaryCards
  timeRangePicker: TimeRangePicker
  activeTimeChart: ActiveTimeChart
  inputChart: InputChart
  categoryDetail: CategoryDetail
  appUsageChart: AppUsageChart
  projectChart: ProjectChart
  callChart: CallChart
  entertainmentChart: EntertainmentChart
  aiChart: AiChart
  trackingBtn: HTMLElement
  trackingDot: HTMLElement
  trackingLabel: HTMLElement
  _currentRange: TimeRange

  constructor() {
    this.summaryCards = new SummaryCards()
    this.timeRangePicker = new TimeRangePicker((range) => this.onRangeChange(range))
    this.activeTimeChart = new ActiveTimeChart('chart-active-time')
    this.inputChart = new InputChart('chart-input')
    this.categoryDetail = new CategoryDetail()
    this.appUsageChart = new AppUsageChart('chart-categories', 'chart-apps', this.categoryDetail)
    this.projectChart = new ProjectChart('chart-projects')
    this.callChart = new CallChart('chart-calls')
    this.entertainmentChart = new EntertainmentChart('chart-entertainment')
    this.aiChart = new AiChart('chart-ai')

    // Tracking toggle
    this.trackingBtn = document.getElementById('tracking-btn')!
    this.trackingDot = document.getElementById('tracking-dot')!
    this.trackingLabel = document.getElementById('tracking-label')!
    this.trackingBtn.addEventListener('click', () => this.toggleTracking())
    this._updateTrackingStatus()

    // Show dev badge in header
    this._showDevBadge()

    // Load initial data
    this._currentRange = getToday()
    this.onRangeChange(this._currentRange)

    // Auto-refresh every 30 seconds, but only when the dashboard window is focused
    setInterval(() => {
      if (!document.hasFocus()) return
      const range = this._getFreshRange()
      this.onRangeChange(range)
    }, 30000)

    // Refresh immediately when the window regains focus
    window.addEventListener('focus', () => {
      const range = this._getFreshRange()
      this.onRangeChange(range)
    })
  }

  async toggleTracking(): Promise<void> {
    const result = await window.monitor.toggleTracking()
    this._setTrackingUI(result.isTracking)
  }

  async _updateTrackingStatus(): Promise<void> {
    const result = await window.monitor.getTrackingStatus()
    this._setTrackingUI(result.isTracking)
  }

  _setTrackingUI(isTracking: boolean): void {
    if (isTracking) {
      this.trackingDot.classList.remove('paused')
      this.trackingLabel.textContent = 'Tracking'
    } else {
      this.trackingDot.classList.add('paused')
      this.trackingLabel.textContent = 'Paused'
    }
  }

  async _showDevBadge(): Promise<void> {
    const isDev = await window.monitor.isDev()
    if (isDev) {
      const title = document.querySelector('.header-title')
      if (title) {
        const badge = document.createElement('span')
        badge.className = 'dev-badge'
        badge.textContent = 'DEV'
        title.appendChild(badge)
      }
    }
  }

  _getFreshRange(): TimeRange {
    const type = this._currentRange.type
    if (type === 'today') return getToday()
    if (type === 'week') return getThisWeek()
    if (type === 'month') return getThisMonth()
    return this._currentRange
  }

  async onRangeChange(range: TimeRange): Promise<void> {
    this._currentRange = range
    const { start, end, type } = range

    try {
      await Promise.all([
        this.summaryCards.render(start, end),
        this.activeTimeChart.render(start, end, type),
        this.inputChart.render(start, end, type),
        this.appUsageChart.render(start, end),
        this.projectChart.render(start, end),
        this.callChart.render(start, end, type),
        this.entertainmentChart.render(start, end, type),
        this.aiChart.render(start, end, type),
      ])
    } catch (err) {
      console.error('Failed to render dashboard:', err)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Dashboard()
})
