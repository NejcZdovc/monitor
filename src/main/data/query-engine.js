class QueryEngine {
  constructor(db) {
    this.db = db;
  }

  getSummaryTotals(startMs, endMs) {
    const active = this.db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL) AND is_idle = 0
    `).get(startMs, endMs);

    const idle = this.db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL) AND is_idle = 1
    `).get(startMs, endMs);

    const input = this.db.prepare(`
      SELECT COALESCE(SUM(key_count), 0) as keys, COALESCE(SUM(click_count), 0) as clicks
      FROM input_counts WHERE recorded_at >= ? AND recorded_at < ?
    `).get(startMs, endMs);

    const calls = this.db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total FROM call_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL)
    `).get(startMs, endMs);

    const youtube = this.db.prepare(`
      SELECT COALESCE(SUM(duration_ms), 0) as total FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL)
        AND app_name = 'YouTube' AND is_idle = 0
    `).get(startMs, endMs);

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
    return this.db.prepare(`
      SELECT
        CAST(started_at / 3600000 AS INTEGER) * 3600000 as hour,
        SUM(CASE WHEN is_idle = 0 THEN duration_ms ELSE 0 END) as active_ms,
        SUM(CASE WHEN is_idle = 1 THEN duration_ms ELSE 0 END) as idle_ms
      FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL)
      GROUP BY hour
      ORDER BY hour ASC
    `).all(startMs, endMs);
  }

  getDailyActivity(startMs, endMs) {
    return this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
        SUM(CASE WHEN is_idle = 0 THEN duration_ms ELSE 0 END) as active_ms,
        SUM(CASE WHEN is_idle = 1 THEN duration_ms ELSE 0 END) as idle_ms
      FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL)
      GROUP BY date
      ORDER BY date ASC
    `).all(startMs, endMs);
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
    return this.db.prepare(`
      SELECT category, SUM(duration_ms) as total_ms
      FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY category
      ORDER BY total_ms DESC
    `).all(startMs, endMs);
  }

  getAppBreakdown(startMs, endMs) {
    return this.db.prepare(`
      SELECT app_name, category, SUM(duration_ms) as total_ms
      FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      ORDER BY total_ms DESC
      LIMIT 20
    `).all(startMs, endMs);
  }

  getTopApp(startMs, endMs) {
    return this.db.prepare(`
      SELECT app_name, SUM(duration_ms) as total_ms
      FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      ORDER BY total_ms DESC
      LIMIT 1
    `).get(startMs, endMs);
  }

  getCallTimeByDay(startMs, endMs) {
    return this.db.prepare(`
      SELECT
        app_name,
        strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
        SUM(duration_ms) as total_ms
      FROM call_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL)
      GROUP BY date, app_name
      ORDER BY date ASC
    `).all(startMs, endMs);
  }

  getYouTubeTimeByDay(startMs, endMs) {
    return this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
        SUM(duration_ms) as total_ms
      FROM activity_sessions
      WHERE started_at >= ? AND (ended_at <= ? OR ended_at IS NULL)
        AND app_name = 'YouTube' AND is_idle = 0
      GROUP BY date
      ORDER BY date ASC
    `).all(startMs, endMs);
  }
}

module.exports = { QueryEngine };
