import type { Chart as ChartType } from 'chart.js'
import { Chart } from '../chart-setup'
import { formatDateLabel } from '../date-utils'
import { createTimeScale, formatDuration, hideEmptyState, showEmptyState } from '../format-utils'

const ENTERTAINMENT_COLORS: Record<string, string> = {
  YouTube: '#FF0000',
  Spotify: '#1DB954',
  Music: '#FA2D48',
  Netflix: '#E50914',
  Twitch: '#9146FF',
  TV: '#2997FF',
  Podcasts: '#8C52FF',
  VLC: '#FF8800',
  IINA: '#07C0F2',
  Plex: '#EBAF00',
  Photos: '#FFFFFF',
  'QuickTime Player': '#2997FF',
  'YouTube (background)': '#CC0000',
}

export class EntertainmentChart {
  canvas: HTMLCanvasElement
  chart: ChartType | null

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
    this.chart = null
  }

  async render(startMs: number, endMs: number, _rangeType: string): Promise<void> {
    const data = await window.monitor.getEntertainmentTime(startMs, endMs)

    if (this.chart) this.chart.destroy()
    this.chart = null

    if (!data.length) {
      showEmptyState(this.canvas, 'No entertainment activity recorded yet')
      return
    }
    hideEmptyState(this.canvas)

    // Group by app
    const appMap: Record<string, Record<string, number>> = {}
    const dates = new Set<string>()
    for (const row of data) {
      dates.add(row.date)
      if (!appMap[row.app_name]) appMap[row.app_name] = {}
      appMap[row.app_name][row.date] = row.total_ms
    }

    const sortedDates = [...dates].sort()

    const scale = createTimeScale(Math.max(...data.map((d) => d.total_ms)))

    const datasets = Object.entries(appMap).map(([appName, dateMap]) => ({
      label: appName,
      data: sortedDates.map((d) => scale.convert(dateMap[d] || 0)),
      backgroundColor: ENTERTAINMENT_COLORS[appName] || '#d16969',
      borderRadius: 4,
      borderSkipped: false as const,
    }))

    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: {
        labels: sortedDates.map((d) => formatDateLabel(d)),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: scale.label, color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { labels: { color: '#d4d4d4', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                return `${ctx.dataset.label}: ${formatDuration(scale.toMs(ctx.raw as number))}`
              },
            },
          },
        },
      },
    })
  }
}
