const CALL_COLORS = {
  'Zoom': '#2D8CFF',
  'Microsoft Teams': '#6264A7',
  'FaceTime': '#34C759',
  'Google Meet': '#00897B'
};

class CallChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  async render(startMs, endMs, rangeType) {
    const data = await window.monitor.getCallTime(startMs, endMs);

    if (this.chart) this.chart.destroy();
    this.chart = null;

    if (!data.length) {
      showEmptyState(this.canvas, 'No calls recorded yet');
      return;
    }
    hideEmptyState(this.canvas);

    // Group by app
    const appMap = {};
    const dates = new Set();
    for (const row of data) {
      dates.add(row.date);
      if (!appMap[row.app_name]) appMap[row.app_name] = {};
      appMap[row.app_name][row.date] = row.total_ms;
    }

    const sortedDates = [...dates].sort();
    const datasets = Object.entries(appMap).map(([appName, dateMap]) => ({
      label: appName,
      data: sortedDates.map(d => msToHours(dateMap[d] || 0)),
      backgroundColor: CALL_COLORS[appName] || '#569cd6',
      borderRadius: 4,
      borderSkipped: false
    }));

    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: {
        labels: sortedDates.map(d => DateUtils.formatDateLabel(d)),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: 'Hours', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { labels: { color: '#d4d4d4', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatDuration(ctx.raw * 3600000)}`
            }
          }
        }
      }
    });
  }
}
