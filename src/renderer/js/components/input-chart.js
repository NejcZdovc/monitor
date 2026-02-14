class InputChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
  }

  async render(startMs, endMs, rangeType) {
    const data = await window.monitor.getInputActivity(startMs, endMs);

    if (this.chart) this.chart.destroy();
    this.chart = null;

    if (!data.length) {
      showEmptyState(this.canvas, 'No input activity recorded yet');
      return;
    }
    hideEmptyState(this.canvas);

    this.chart = new Chart(this.canvas, {
      type: 'line',
      data: {
        labels: data.map(d => new Date(d.recorded_at)),
        datasets: [
          {
            label: 'Keystrokes',
            data: data.map(d => d.key_count),
            borderColor: '#569cd6',
            backgroundColor: 'rgba(86,156,214,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHitRadius: 10,
            borderWidth: 2
          },
          {
            label: 'Clicks',
            data: data.map(d => d.click_count),
            borderColor: '#4ec9b0',
            backgroundColor: 'rgba(78,201,176,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHitRadius: 10,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: rangeType === 'today' ? 'hour' : 'day',
              displayFormats: {
                hour: 'ha',
                day: 'MMM d'
              }
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 }, maxTicksLimit: 12 }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Count / min', color: '#858585' },
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#858585', font: { size: 11 } }
          }
        },
        plugins: {
          legend: { labels: { color: '#d4d4d4', boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const d = new Date(items[0].parsed.x);
                return d.toLocaleString();
              }
            }
          }
        }
      }
    });
  }
}
