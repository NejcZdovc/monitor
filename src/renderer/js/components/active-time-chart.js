class ActiveTimeChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  async render(startMs, endMs, rangeType) {
    let data, labels, activeData, idleData;

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
    idleData = data.map(d => convert(d.idle_ms));

    if (this.chart) this.chart.destroy();
    this.chart = null;

    if (!data.length) {
      showEmptyState(this.canvas, 'No activity recorded yet');
      return;
    }
    hideEmptyState(this.canvas);

    // Plugin to draw active time values above each stacked bar
    const barValuePlugin = {
      id: 'barValues',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const idleMeta = chart.getDatasetMeta(1); // Idle is on top of the stack
        const activeMeta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#d4d4d4';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        activeMeta.data.forEach((bar, i) => {
          const value = activeData[i];
          if (value <= 0) return;
          const ms = useMinutes ? value * 60000 : value * 3600000;
          const label = formatDuration(ms);
          // Draw above the top of the full stacked bar (idle is on top)
          const topBar = idleMeta.data[i];
          const topY = topBar && idleData[i] > 0 ? topBar.y : bar.y;
          ctx.fillText(label, bar.x, topY - 4);
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
        layout: {
          padding: { top: 20 }
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: useMinutes ? 'Minutes' : 'Hours', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { labels: { color: '#d4d4d4', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const ms = useMinutes ? ctx.raw * 60000 : ctx.raw * 3600000;
                return `${ctx.dataset.label}: ${formatDuration(ms)}`;
              }
            }
          }
        }
      },
      plugins: [barValuePlugin]
    });
  }
}
