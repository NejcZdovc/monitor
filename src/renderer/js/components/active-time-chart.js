class ActiveTimeChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  async render(startMs, endMs, rangeType) {
    let data, labels, activeData, idleData;

    if (rangeType === 'today') {
      data = await window.monitor.getHourlyActivity(startMs, endMs);
      labels = data.map(d => DateUtils.formatHourLabel(d.hour));
      activeData = data.map(d => msToHours(d.active_ms));
      idleData = data.map(d => msToHours(d.idle_ms));
    } else {
      data = await window.monitor.getDailyActivity(startMs, endMs);
      labels = data.map(d => DateUtils.formatDateLabel(d.date));
      activeData = data.map(d => msToHours(d.active_ms));
      idleData = data.map(d => msToHours(d.idle_ms));
    }

    if (this.chart) this.chart.destroy();
    this.chart = null;

    if (!data.length) {
      showEmptyState(this.canvas, 'No activity recorded yet');
      return;
    }
    hideEmptyState(this.canvas);

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
            borderSkipped: false
          },
          {
            label: 'Idle',
            data: idleData,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 4,
            borderSkipped: false
          }
        ]
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
