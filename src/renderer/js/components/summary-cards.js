class SummaryCards {
  async render(startMs, endMs) {
    const data = await window.monitor.getSummary(startMs, endMs);

    document.getElementById('val-active-time').textContent = formatDurationShort(data.activeTimeMs);
    document.getElementById('val-keys').textContent = formatNumber(data.totalKeys);
    document.getElementById('val-clicks').textContent = formatNumber(data.totalClicks);
    document.getElementById('val-calls').textContent = formatDurationShort(data.callTimeMs);
    document.getElementById('val-youtube').textContent = formatDurationShort(data.youtubeTimeMs);
  }
}
