import type { Chart as ChartType } from 'chart.js'
import { Chart } from '../chart-setup'
import { hideEmptyState, showEmptyState } from '../format-utils'

export class InputChart {
  canvas: HTMLCanvasElement
  chart: ChartType | null

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
    this.chart = null
  }

  async render(startMs: number, endMs: number, rangeType: string): Promise<void> {
    const data = await window.monitor.getInputActivity(startMs, endMs)

    if (this.chart) this.chart.destroy()
    this.chart = null

    if (!data.length) {
      showEmptyState(this.canvas, 'No input activity recorded yet')
      return
    }
    hideEmptyState(this.canvas)

    // Bucket data by hour (today) or by day (other ranges)
    const useHourly = rangeType === 'today'
    const buckets = new Map<number, { keys: number; clicks: number }>()

    for (const d of data) {
      const date = new Date(d.recorded_at)
      let key: number
      if (useHourly) {
        key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime()
      } else {
        key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      }
      if (!buckets.has(key)) {
        buckets.set(key, { keys: 0, clicks: 0 })
      }
      const bucket = buckets.get(key)!
      bucket.keys += d.key_count
      bucket.clicks += d.click_count
    }

    // Generate all time slots between start and end, filling gaps with 0
    const allSlots: number[] = []
    const slotStart = new Date(startMs)
    let cursor: Date
    if (useHourly) {
      cursor = new Date(slotStart.getFullYear(), slotStart.getMonth(), slotStart.getDate(), slotStart.getHours())
    } else {
      cursor = new Date(slotStart.getFullYear(), slotStart.getMonth(), slotStart.getDate())
    }

    const now = Date.now()
    const slotEnd = Math.min(endMs, now) // Don't generate future slots

    while (cursor.getTime() <= slotEnd) {
      allSlots.push(cursor.getTime())
      if (useHourly) {
        cursor = new Date(cursor.getTime() + 3600000) // +1 hour
      } else {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1) // +1 day
      }
    }

    const labels = allSlots.map((k) => new Date(k))
    const keyData = allSlots.map((k) => (buckets.has(k) ? buckets.get(k)!.keys : 0))
    const clickData = allSlots.map((k) => (buckets.has(k) ? buckets.get(k)!.clicks : 0))

    this.chart = new Chart(this.canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Keystrokes',
            data: keyData,
            borderColor: 'rgba(86,156,214,0.9)',
            backgroundColor: 'rgba(86,156,214,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Clicks',
            data: clickData,
            borderColor: 'rgba(78,201,176,0.9)',
            backgroundColor: 'rgba(78,201,176,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: useHourly ? 'hour' : 'day',
              displayFormats: {
                hour: 'ha',
                day: 'MMM d',
              },
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 }, maxTicksLimit: 12 },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Count', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } },
          },
        },
        plugins: {
          legend: { labels: { color: '#d4d4d4', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const d = new Date(items[0].parsed.x as number)
                if (useHourly) {
                  return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })
                }
                return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              },
            },
          },
        },
      },
    })
  }
}
