class YouTubeChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  async render(startMs, endMs, rangeType) {
    const data = await window.monitor.getYouTubeTime(startMs, endMs);

    if (this.chart) this.chart.destroy();
    this.chart = null;

    if (!data.length) {
      showEmptyState(this.canvas, 'No YouTube activity recorded yet');
      return;
    }
    hideEmptyState(this.canvas);

    const maxMs = Math.max(...data.map(d => d.total_ms));
    const useMinutes = maxMs < 7200000; // 120 minutes
    const convert = useMinutes ? (ms) => ms / 60000 : msToHours;

    this.chart = new Chart(this.canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => DateUtils.formatDateLabel(d.date)),
        datasets: [{
          label: 'YouTube',
          data: data.map(d => convert(d.total_ms)),
          backgroundColor: '#d16969',
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
                return `YouTube: ${formatDuration(ms)}`;
              }
            }
          }
        }
      }
    });
  }
}
