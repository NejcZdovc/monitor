class QueryEngine {
  constructor(db) {
    this.db = db;
  }

  getSummaryTotals(startMs, endMs) {
    const now = Date.now();
    // Use clamped duration: only count the portion of each session that falls within [startMs, endMs)
    // For open sessions (ended_at IS NULL), use current time instead of range end
    const active = this.db.prepare(`
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
    `).get(now, endMs, startMs, endMs, startMs);

    const idle = this.db.prepare(`
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 1
    `).get(now, endMs, startMs, endMs, startMs);

    const input = this.db.prepare(`
      SELECT COALESCE(SUM(key_count), 0) as keys, COALESCE(SUM(click_count), 0) as clicks
      FROM input_counts WHERE recorded_at >= ? AND recorded_at < ?
    `).get(startMs, endMs);

    const calls = this.db.prepare(`
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM call_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
    `).get(now, endMs, startMs, endMs, startMs);

    const youtube = this.db.prepare(`
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
        AND app_name = 'YouTube' AND is_idle = 0
    `).get(now, endMs, startMs, endMs, startMs);

    return {
      activeTimeMs: active.total,
      idleTimeMs: idle.total,
      totalKeys: input.keys,
      totalClicks: input.clicks,
      callTimeMs: calls.total,
      youtubeTimeMs: youtube.total
    };
  }

  getHourlyActivity(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT
        CAST(MAX(started_at, ?) / 3600000 AS INTEGER) * 3600000 as hour,
        SUM(CASE WHEN is_idle = 0 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as active_ms,
        SUM(CASE WHEN is_idle = 1 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as idle_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      GROUP BY hour
      ORDER BY hour ASC
    `).all(startMs, now, endMs, startMs, now, endMs, startMs, endMs, startMs);
  }

  getDailyActivity(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d', MAX(started_at, ?) / 1000, 'unixepoch', 'localtime') as date,
        SUM(CASE WHEN is_idle = 0 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as active_ms,
        SUM(CASE WHEN is_idle = 1 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as idle_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      GROUP BY date
      ORDER BY date ASC
    `).all(startMs, now, endMs, startMs, now, endMs, startMs, endMs, startMs);
  }

  getInputActivity(startMs, endMs) {
    return this.db.prepare(`
      SELECT recorded_at, key_count, click_count
      FROM input_counts
      WHERE recorded_at >= ? AND recorded_at < ?
      ORDER BY recorded_at ASC
    `).all(startMs, endMs);
  }

  getCategoryBreakdown(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT category, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY category
      ORDER BY total_ms DESC
    `).all(now, endMs, startMs, endMs, startMs);
  }

  getAppBreakdown(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT app_name, category, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      ORDER BY total_ms DESC
      LIMIT 20
    `).all(now, endMs, startMs, endMs, startMs);
  }

  getAppsByCategory(category, startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT app_name, category, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE category = ? AND started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      ORDER BY total_ms DESC
    `).all(now, endMs, startMs, category, endMs, startMs);
  }

  getTopApp(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT app_name, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      ORDER BY total_ms DESC
      LIMIT 1
    `).get(now, endMs, startMs, endMs, startMs);
  }

  getCallTimeByDay(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT
        app_name,
        strftime('%Y-%m-%d', MAX(started_at, ?) / 1000, 'unixepoch', 'localtime') as date,
        SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM call_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      GROUP BY date, app_name
      ORDER BY date ASC
    `).all(startMs, now, endMs, startMs, endMs, startMs);
  }

  getYouTubeTimeByDay(startMs, endMs) {
    const now = Date.now();
    return this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d', MAX(started_at, ?) / 1000, 'unixepoch', 'localtime') as date,
        SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
        AND app_name = 'YouTube' AND is_idle = 0
      GROUP BY date
      ORDER BY date ASC
    `).all(startMs, now, endMs, startMs, endMs, startMs);
  }
}

module.exports = { QueryEngine };
