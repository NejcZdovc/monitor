const CATEGORY_COLORS = {
  Coding: '#569cd6',
  Terminal: '#b5cea8',
  AI: '#c586c0',
  Communication: '#4fc1ff',
  Meetings: '#ce9178',
  Browsers: '#9cdcfe',
  Productivity: '#4ec9b0',
  DevTools: '#dcdcaa',
  Entertainment: '#d16969',
  System: '#808080',
  Other: '#6a9955',
  Idle: '#3c3c3c'
};

class AppUsageChart {
  constructor(categoryCanvasId, appsCanvasId, categoryDetail) {
    this.categoryCanvas = document.getElementById(categoryCanvasId);
    this.appsCanvas = document.getElementById(appsCanvasId);
    this.categoryChart = null;
    this.appsChart = null;
    this.categoryDetail = categoryDetail;
    this.startMs = null;
    this.endMs = null;
  }

  async render(startMs, endMs) {
    this.startMs = startMs;
    this.endMs = endMs;

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

    const self = this;

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
        onHover: (event, elements) => {
          event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (event, elements) => {
          if (elements.length > 0 && self.categoryDetail) {
            const idx = elements[0].index;
            const category = filtered[idx].category;
            const totalMs = filtered[idx].total_ms;
            const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
            self.categoryDetail.open(category, color, totalMs, self.startMs, self.endMs);
          }
        },
        plugins: {
          legend: {
            position: 'right',
            onClick: (event, legendItem) => {
              if (self.categoryDetail) {
                const idx = legendItem.index;
                const category = filtered[idx].category;
                const totalMs = filtered[idx].total_ms;
                const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
                self.categoryDetail.open(category, color, totalMs, self.startMs, self.endMs);
              }
            },
            onHover: (event) => {
              event.native.target.style.cursor = 'pointer';
            },
            onLeave: (event) => {
              event.native.target.style.cursor = 'default';
            },
            labels: {
              color: '#d4d4d4',
              boxWidth: 10,
              padding: 10,
              font: { size: 11 },
              generateLabels: (chart) => {
                const data = chart.data;
                return data.labels.map((label, i) => ({
                  text: `${label}  ${formatDuration(data.datasets[0].data[i])}`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  fontColor: '#d4d4d4',
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
            title: { display: true, text: 'Hours', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#d4d4d4', font: { size: 11 } }
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
