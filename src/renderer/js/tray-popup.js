/* trayApi is exposed on window by the preload via contextBridge */

function fmtDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return hours + 'h ' + minutes + 'm';
  return minutes + 'm';
}

function fmtNumber(n) {
  if (!n) return '0';
  return n.toLocaleString();
}

async function refresh() {
  try {
    const data = await window.trayApi.getStats();
    document.getElementById('activeTime').textContent = fmtDuration(data.activeTimeMs);
    document.getElementById('keystrokes').textContent = fmtNumber(data.totalKeys);
    document.getElementById('clicks').textContent = fmtNumber(data.totalClicks);
    document.getElementById('callTime').textContent = fmtDuration(data.callTimeMs);
    document.getElementById('youtube').textContent = fmtDuration(data.youtubeTimeMs);

    const topApp = data.topApp;
    document.getElementById('topApp').textContent = topApp
      ? topApp.app_name + ' (' + fmtDuration(topApp.total_ms) + ')'
      : 'None';

    const badge = document.getElementById('trackingBadge');
    const label = document.getElementById('trackingLabel');
    const toggleBtn = document.getElementById('toggleBtn');
    if (data.isTracking) {
      badge.className = 'tracking-badge active';
      label.textContent = 'Tracking';
      toggleBtn.innerHTML = '<span class="icon">\u275A\u275A</span> Pause Tracking';
    } else {
      badge.className = 'tracking-badge paused';
      label.textContent = 'Paused';
      toggleBtn.innerHTML = '<span class="icon">\u25B6</span> Resume Tracking';
    }
  } catch (err) {
    console.error('Failed to refresh tray stats:', err);
  }
}

document.getElementById('dashboardBtn').addEventListener('click', () => {
  window.trayApi.openDashboard();
});

document.getElementById('toggleBtn').addEventListener('click', async () => {
  await window.trayApi.toggleTracking();
  await refresh();
});

document.getElementById('quitBtn').addEventListener('click', () => {
  window.trayApi.quit();
});

document.getElementById('trackingBadge').addEventListener('click', async () => {
  await window.trayApi.toggleTracking();
  await refresh();
});

// Listen for refresh signals from main process
window.trayApi.onRefresh(() => {
  refresh();
});

// Initial load
refresh();
