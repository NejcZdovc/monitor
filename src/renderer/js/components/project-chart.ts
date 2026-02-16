import type { Chart as ChartType } from 'chart.js'
import { Chart } from '../chart-setup'
import { createTimeScale, formatDuration, hideEmptyState, showEmptyState } from '../format-utils'

export class ProjectChart {
  canvas: HTMLCanvasElement
  chart: ChartType | null

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
    this.chart = null
  }

  async render(startMs: number, endMs: number): Promise<void> {
    const data = await window.monitor.getProjectBreakdown(startMs, endMs)

    if (this.chart) this.chart.destroy()
    this.chart = null

    if (!data.length) {
      showEmptyState(this.canvas, 'No project data yet')
      return
    }
    hideEmptyState(this.canvas)

    const top10 = data.slice(0, 10)

    const scale = createTimeScale(Math.max(...top10.map((d) => d.total_ms)))

    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: {
        labels: top10.map((d) => d.project),
        datasets: [
          {
            data: top10.map((d) => scale.convert(d.total_ms)),
            backgroundColor: '#569cd6',
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: scale.label, color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#d4d4d4', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                return formatDuration(scale.toMs(ctx.raw as number))
              },
            },
          },
        },
      },
    })
  }
}
