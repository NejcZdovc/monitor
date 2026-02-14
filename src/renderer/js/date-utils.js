const DateUtils = {
  getToday() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.getTime(), end: end.getTime(), type: 'today' };
  },

  getThisWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
    const start = new Date(now.getFullYear(), now.getMonth(), diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start: start.getTime(), end: end.getTime(), type: 'week' };
  },

  getThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.getTime(), end: end.getTime(), type: 'month' };
  },

  getCustomRange(startDate, endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    return { start: start.getTime(), end: end.getTime(), type: 'custom' };
  },

  formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  formatHourLabel(hourMs) {
    const d = new Date(hourMs);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }
};
