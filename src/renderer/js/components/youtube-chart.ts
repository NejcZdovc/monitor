import type { Chart as ChartType } from 'chart.js'
import { Chart } from '../chart-setup'
import { formatDateLabel } from '../date-utils'
import { formatDuration, hideEmptyState, msToHours, showEmptyState } from '../format-utils'

export class YouTubeChart {
  canvas: HTMLCanvasElement
  chart: ChartType | null

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
    this.chart = null
  }

  async render(startMs: number, endMs: number, _rangeType: string): Promise<void> {
    const data = await window.monitor.getYouTubeTime(startMs, endMs)

    if (this.chart) this.chart.destroy()
    this.chart = null

    if (!data.length) {
      showEmptyState(this.canvas, 'No YouTube activity recorded yet')
      return
    }
    hideEmptyState(this.canvas)

    const maxMs = Math.max(...data.map((d) => d.total_ms))
    const useMinutes = maxMs < 7200000 // 120 minutes
    const convert = useMinutes ? (ms: number) => ms / 60000 : msToHours

    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: {
        labels: data.map((d) => formatDateLabel(d.date)),
        datasets: [
          {
            label: 'YouTube',
            data: data.map((d) => convert(d.total_ms)),
            backgroundColor: '#d16969',
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: useMinutes ? 'Minutes' : 'Hours', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const ms = useMinutes ? (ctx.raw as number) * 60000 : (ctx.raw as number) * 3600000
                return `YouTube: ${formatDuration(ms)}`
              },
            },
          },
        },
      },
    })
  }
}
