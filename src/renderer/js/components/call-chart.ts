import type { Chart as ChartType } from 'chart.js'
import { Chart } from '../chart-setup'
import { formatDateLabel } from '../date-utils'
import { formatDuration, hideEmptyState, msToHours, showEmptyState } from '../format-utils'

const CALL_COLORS: Record<string, string> = {
  Zoom: '#2D8CFF',
  'Microsoft Teams': '#6264A7',
  FaceTime: '#34C759',
  'Google Meet': '#00897B',
}

export class CallChart {
  canvas: HTMLCanvasElement
  chart: ChartType | null

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
    this.chart = null
  }

  async render(startMs: number, endMs: number, _rangeType: string): Promise<void> {
    const data = await window.monitor.getCallTime(startMs, endMs)

    if (this.chart) this.chart.destroy()
    this.chart = null

    if (!data.length) {
      showEmptyState(this.canvas, 'No calls recorded yet')
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
    const datasets = Object.entries(appMap).map(([appName, dateMap]) => ({
      label: appName,
      data: sortedDates.map((d) => msToHours(dateMap[d] || 0)),
      backgroundColor: CALL_COLORS[appName] || '#569cd6',
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
            title: { display: true, text: 'Hours', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { labels: { color: '#d4d4d4', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatDuration((ctx.raw as number) * 3600000)}`,
            },
          },
        },
      },
    })
  }
}
