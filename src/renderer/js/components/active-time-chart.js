class ActiveTimeChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  async render(startMs, endMs, rangeType) {
    let data, labels, activeData;

    const useMinutes = rangeType === 'today';
    const convert = useMinutes ? (ms) => ms / 60000 : msToHours;

    if (rangeType === 'today') {
      data = await window.monitor.getHourlyActivity(startMs, endMs);
      labels = data.map(d => DateUtils.formatHourLabel(d.hour));
    } else {
      data = await window.monitor.getDailyActivity(startMs, endMs);
      labels = data.map(d => DateUtils.formatDateLabel(d.date));
    }

    activeData = data.map(d => convert(d.active_ms));

    if (this.chart) this.chart.destroy();
    this.chart = null;

    if (!data.length) {
      showEmptyState(this.canvas, 'No activity recorded yet');
      return;
    }
    hideEmptyState(this.canvas);

    // Plugin to draw active time values above each bar
    const barValuePlugin = {
      id: 'barValues',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#d4d4d4';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        meta.data.forEach((bar, i) => {
          const value = activeData[i];
          if (value <= 0) return;
          const ms = useMinutes ? value * 60000 : value * 3600000;
          const label = formatDuration(ms);
          ctx.fillText(label, bar.x, bar.y - 4);
        });
        ctx.restore();
      }
    };

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
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20 }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: useMinutes ? 'Minutes' : 'Hours', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const ms = useMinutes ? ctx.raw * 60000 : ctx.raw * 3600000;
                return `Active: ${formatDuration(ms)}`;
              }
            }
          }
        }
      },
      plugins: [barValuePlugin]
    });
  }
}
