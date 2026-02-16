import { formatDurationShort, formatNumber } from '../format-utils'

export class SummaryCards {
  async render(startMs: number, endMs: number): Promise<void> {
    const data = await window.monitor.getSummary(startMs, endMs)

    document.getElementById('val-active-time')!.textContent = formatDurationShort(data.activeTimeMs)
    document.getElementById('val-keys')!.textContent = formatNumber(data.totalKeys)
    document.getElementById('val-clicks')!.textContent = formatNumber(data.totalClicks)
    document.getElementById('val-calls')!.textContent = formatDurationShort(data.callTimeMs)
    document.getElementById('val-entertainment')!.textContent = formatDurationShort(data.entertainmentTimeMs)
    document.getElementById('val-ai')!.textContent = formatDurationShort(data.aiTimeMs)
  }
}
