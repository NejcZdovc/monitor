/* trayApi is exposed on window by the preload via contextBridge */

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function fmtNumber(n: number): string {
  if (!n) return '0'
  return n.toLocaleString()
}

async function refresh(): Promise<void> {
  try {
    const data = await window.trayApi.getStats()
    document.getElementById('activeTime')!.textContent = fmtDuration(data.activeTimeMs)
    document.getElementById('keystrokes')!.textContent = fmtNumber(data.totalKeys)
    document.getElementById('clicks')!.textContent = fmtNumber(data.totalClicks)
    document.getElementById('callTime')!.textContent = fmtDuration(data.callTimeMs)
    document.getElementById('entertainment')!.textContent = fmtDuration(data.entertainmentTimeMs)
    document.getElementById('aiTime')!.textContent = fmtDuration(data.aiTimeMs)

    const topApp = data.topApp
    document.getElementById('topApp')!.textContent = topApp
      ? `${topApp.app_name} (${fmtDuration(topApp.total_ms)})`
      : 'None'

    const badge = document.getElementById('trackingBadge')!
    const label = document.getElementById('trackingLabel')!
    const toggleBtn = document.getElementById('toggleBtn')!
    if (data.isTracking) {
      badge.className = 'tracking-badge active'
      label.textContent = 'Tracking'
      toggleBtn.innerHTML = '<span class="icon">\u275A\u275A</span> Pause Tracking'
    } else {
      badge.className = 'tracking-badge paused'
      label.textContent = 'Paused'
      toggleBtn.innerHTML = '<span class="icon">\u25B6</span> Resume Tracking'
    }
  } catch (err) {
    console.error('Failed to refresh tray stats:', err)
  }
}

document.getElementById('dashboardBtn')?.addEventListener('click', () => {
  window.trayApi.openDashboard()
})

document.getElementById('toggleBtn')?.addEventListener('click', async () => {
  await window.trayApi.toggleTracking()
  await refresh()
})

document.getElementById('quitBtn')?.addEventListener('click', () => {
  window.trayApi.quit()
})

document.getElementById('trackingBadge')?.addEventListener('click', async () => {
  await window.trayApi.toggleTracking()
  await refresh()
})

// Update button
const updateBtn = document.getElementById('updateBtn')!

async function refreshUpdateBtn(): Promise<void> {
  const version = await window.trayApi.getPendingVersion()
  if (version) {
    updateBtn.innerHTML =
      '<span class="icon"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" /></svg></span>' +
      `Upgrade to ${version}`
  }
}

updateBtn.addEventListener('click', async () => {
  const version = await window.trayApi.getPendingVersion()
  if (version) {
    window.trayApi.quitAndInstall()
  } else {
    window.trayApi.checkForUpdates()
  }
})

window.trayApi.onUpdateReady((version) => {
  updateBtn.innerHTML =
    '<span class="icon"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" /></svg></span>' +
    `Upgrade to ${version}`
})

// Listen for refresh signals from main process
window.trayApi.onRefresh(() => {
  refresh()
})

// Initial load
refresh()
refreshUpdateBtn()
