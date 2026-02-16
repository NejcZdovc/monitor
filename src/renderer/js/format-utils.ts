export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatDurationShort(ms: number): string {
  if (!ms || ms <= 0) return '--:--'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--'
  return n.toLocaleString()
}

export function formatHours(ms: number): string {
  return (ms / 3600000).toFixed(1)
}

export function msToHours(ms: number): number {
  return ms / 3600000
}

export function showEmptyState(canvas: HTMLCanvasElement, message?: string): void {
  const wrap = canvas.parentElement!
  canvas.style.display = 'none'
  let el = wrap.querySelector('.empty-state') as HTMLElement | null
  if (!el) {
    el = document.createElement('div')
    el.className = 'empty-state'
    wrap.appendChild(el)
  }
  el.textContent = message || 'No data for this period'
  el.style.display = 'flex'
}

export function hideEmptyState(canvas: HTMLCanvasElement): void {
  const wrap = canvas.parentElement!
  canvas.style.display = ''
  const el = wrap.querySelector('.empty-state') as HTMLElement | null
  if (el) el.style.display = 'none'
}
