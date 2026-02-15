function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatDurationShort(ms) {
  if (!ms || ms <= 0) return '--:--'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}

function formatNumber(n) {
  if (n === null || n === undefined) return '--'
  return n.toLocaleString()
}

function formatHours(ms) {
  return (ms / 3600000).toFixed(1)
}

function msToHours(ms) {
  return ms / 3600000
}

function showEmptyState(canvas, message) {
  const wrap = canvas.parentElement
  canvas.style.display = 'none'
  let el = wrap.querySelector('.empty-state')
  if (!el) {
    el = document.createElement('div')
    el.className = 'empty-state'
    wrap.appendChild(el)
  }
  el.textContent = message || 'No data for this period'
  el.style.display = 'flex'
}

function hideEmptyState(canvas) {
  const wrap = canvas.parentElement
  canvas.style.display = ''
  const el = wrap.querySelector('.empty-state')
  if (el) el.style.display = 'none'
}
