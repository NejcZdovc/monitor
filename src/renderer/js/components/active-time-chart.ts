import type { Chart as ChartType } from 'chart.js'
import { Chart } from '../chart-setup'
import { formatDateLabel, formatHourLabel } from '../date-utils'
import { createTimeScale, formatDuration, hideEmptyState, showEmptyState } from '../format-utils'

export class ActiveTimeChart {
  canvas: HTMLCanvasElement
  chart: ChartType | null
  onBarClick: ((dateStr: string) => void) | null

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
    this.chart = null
    this.onBarClick = null
  }

  async render(startMs: number, endMs: number, rangeType: string): Promise<void> {
    let data: Array<{ hour?: number; date?: string; active_ms: number }>
    let labels: string[]

    // Today shows hourly data in minutes, week/month shows daily data in hours
    const scale = createTimeScale(rangeType === 'today' ? 0 : Infinity)

    if (rangeType === 'today') {
      const raw = await window.monitor.getHourlyActivity(startMs, endMs)
      // Fill gaps so every hour between first and last active hour gets a bar
      const active = raw.filter((d) => d.active_ms > 0)
      if (active.length > 0) {
        const hourMap = new Map(raw.map((d) => [d.hour!, d.active_ms]))
        const firstHour = active[0].hour!
        const lastHour = active[active.length - 1].hour!
        data = []
        for (let h = firstHour; h <= lastHour; h += 3600000) {
          data.push({ hour: h, active_ms: hourMap.get(h) || 0 })
        }
      } else {
        data = []
      }
      labels = data.map((d) => formatHourLabel(d.hour!))
    } else {
      const raw = await window.monitor.getDailyActivity(startMs, endMs)
      // Fill gaps so every day from range start to today gets a bar (0 if no data)
      const dateMap = new Map(raw.map((d) => [d.date!, d.active_ms]))
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const rangeEnd = new Date(Math.min(endMs, today.getTime() + 86400000))
      rangeEnd.setHours(0, 0, 0, 0)
      data = []
      const cursor = new Date(startMs)
      cursor.setHours(0, 0, 0, 0)
      while (cursor < rangeEnd) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        data.push({ date: key, active_ms: dateMap.get(key) || 0 })
        cursor.setDate(cursor.getDate() + 1)
      }
      labels = data.map((d) => formatDateLabel(d.date!))
    }

    const activeData = data.map((d) => scale.convert(d.active_ms))

    if (this.chart) this.chart.destroy()
    this.chart = null

    if (!data.length) {
      showEmptyState(this.canvas, 'No activity recorded yet')
      return
    }
    hideEmptyState(this.canvas)

    // Plugin to draw active time values above each bar
    const barValuePlugin = {
      id: 'barValues',
      afterDatasetsDraw(chart: ChartType) {
        const { ctx } = chart
        const meta = chart.getDatasetMeta(0)
        ctx.save()
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
        ctx.fillStyle = '#d4d4d4'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'

        meta.data.forEach((bar, i) => {
          const value = activeData[i]
          if (value <= 0) return
          const ms = scale.toMs(value)
          const label = formatDuration(ms)
          ctx.fillText(label, bar.x, bar.y - 4)
        })
        ctx.restore()
      },
    }

    const isDrillable = rangeType !== 'today'
    const dateStrings = data.map((d) => d.date ?? '')

    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Active',
            data: activeData,
            backgroundColor: '#569cd6',
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20 },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: scale.label, color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                return `Active: ${formatDuration(scale.toMs(ctx.raw as number))}`
              },
            },
          },
        },
        ...(isDrillable
          ? {
              onClick: (_event, elements) => {
                if (elements.length > 0 && this.onBarClick) {
                  const index = elements[0].index
                  const dateStr = dateStrings[index]
                  if (dateStr) this.onBarClick(dateStr)
                }
              },
              onHover: (event, elements) => {
                const target = event.native?.target as HTMLElement | undefined
                if (target) {
                  target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
                }
              },
            }
          : {}),
      },
      plugins: [barValuePlugin],
    })
  }
}
