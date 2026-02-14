const CATEGORY_COLORS = {
  Coding: '#6366f1',
  Terminal: '#8b5cf6',
  AI: '#a855f7',
  Communication: '#06b6d4',
  Meetings: '#f97316',
  Browsers: '#3b82f6',
  Productivity: '#22c55e',
  DevTools: '#14b8a6',
  Entertainment: '#ec4899',
  System: '#64748b',
  Other: '#94a3b8',
  Idle: '#334155'
};

class AppUsageChart {
  constructor(categoryCanvasId, appsCanvasId) {
    this.categoryCanvas = document.getElementById(categoryCanvasId);
    this.appsCanvas = document.getElementById(appsCanvasId);
    this.categoryChart = null;
    this.appsChart = null;
  }

  async render(startMs, endMs) {
    const [categories, apps] = await Promise.all([
      window.monitor.getCategoryBreakdown(startMs, endMs),
      window.monitor.getAppBreakdown(startMs, endMs)
    ]);

    this._renderCategories(categories);
    this._renderApps(apps);
  }

  _renderCategories(data) {
    if (this.categoryChart) this.categoryChart.destroy();
    this.categoryChart = null;

    const filtered = data.filter(d => d.category !== 'Idle');

    if (!filtered.length) {
      showEmptyState(this.categoryCanvas, 'No category data yet');
      return;
    }
    hideEmptyState(this.categoryCanvas);

    this.categoryChart = new Chart(this.categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: filtered.map(d => d.category),
        datasets: [{
          data: filtered.map(d => d.total_ms),
          backgroundColor: filtered.map(d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS.Other),
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#e8e8f0',
              boxWidth: 10,
              padding: 10,
              font: { size: 11 },
              generateLabels: (chart) => {
                const data = chart.data;
                return data.labels.map((label, i) => ({
                  text: `${label}  ${formatDuration(data.datasets[0].data[i])}`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  fontColor: '#e8e8f0',
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatDuration(ctx.raw)}`
            }
          }
        }
      }
    });
  }

  _renderApps(data) {
    if (this.appsChart) this.appsChart.destroy();
    this.appsChart = null;

    const top10 = data.slice(0, 10).filter(d => d.app_name !== 'Idle');

    if (!top10.length) {
      showEmptyState(this.appsCanvas, 'No app data yet');
      return;
    }
    hideEmptyState(this.appsCanvas);

    this.appsChart = new Chart(this.appsCanvas, {
      type: 'bar',
      data: {
        labels: top10.map(d => d.app_name),
        datasets: [{
          data: top10.map(d => msToHours(d.total_ms)),
          backgroundColor: top10.map(d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS.Other),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Hours', color: '#8888a8' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8888a8', font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#e8e8f0', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => formatDuration(ctx.raw * 3600000)
            }
          }
        }
      }
    });
  }
}
