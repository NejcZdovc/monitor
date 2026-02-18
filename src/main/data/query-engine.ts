import type Database from 'better-sqlite3'
import { extractProjectName } from '../categories'
import type {
  AiTimeRecord,
  AppBreakdown,
  CallTimeRecord,
  CategoryBreakdown,
  DailyActivity,
  EntertainmentTimeRecord,
  HourlyActivity,
  InputRecord,
  ProjectBreakdown,
  SummaryTotals,
  TopApp,
} from '../types'

class QueryEngine {
  db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getSummaryTotals(startMs: number, endMs: number): SummaryTotals {
    const now = Date.now()
    // Use clamped duration: only count the portion of each session that falls within [startMs, endMs)
    // For open sessions (ended_at IS NULL), use current time instead of range end
    const active = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as { total: number }

    const idle = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 1
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as { total: number }

    const input = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(key_count), 0) as keys, COALESCE(SUM(click_count), 0) as clicks
      FROM input_counts WHERE recorded_at >= ? AND recorded_at < ?
    `,
      )
      .get(startMs, endMs) as { keys: number; clicks: number }

    const calls = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM call_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as { total: number }

    const fgEntertainment = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
        AND category = 'Entertainment' AND is_idle = 0
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as { total: number }

    const bgEntertainment = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM background_entertainment_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as { total: number }

    const entertainment = { total: fgEntertainment.total + bgEntertainment.total }

    const ai = this.db
      .prepare(
        `
      SELECT COALESCE(SUM(
        MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)
      ), 0) as total FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
        AND category = 'AI' AND is_idle = 0
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as { total: number }

    return {
      activeTimeMs: active.total,
      idleTimeMs: idle.total,
      totalKeys: input.keys,
      totalClicks: input.clicks,
      callTimeMs: calls.total,
      entertainmentTimeMs: entertainment.total,
      aiTimeMs: ai.total,
    }
  }

  getHourlyActivity(startMs: number, endMs: number): HourlyActivity[] {
    const now = Date.now()
    // Sessions are split at hour boundaries on insert, so simple grouping works
    return this.db
      .prepare(
        `
      SELECT
        CAST(started_at / 3600000 AS INTEGER) * 3600000 as hour,
        SUM(CASE WHEN is_idle = 0 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as active_ms,
        SUM(CASE WHEN is_idle = 1 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as idle_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      GROUP BY hour
      ORDER BY hour ASC
    `,
      )
      .all(now, endMs, startMs, now, endMs, startMs, endMs, startMs) as HourlyActivity[]
  }

  getDailyActivity(startMs: number, endMs: number): DailyActivity[] {
    const now = Date.now()
    // Sessions are split at hour boundaries, so they never span days either
    return this.db
      .prepare(
        `
      SELECT
        strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
        SUM(CASE WHEN is_idle = 0 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as active_ms,
        SUM(CASE WHEN is_idle = 1 THEN MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) ELSE 0 END) as idle_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      GROUP BY date
      ORDER BY date ASC
    `,
      )
      .all(now, endMs, startMs, now, endMs, startMs, endMs, startMs) as DailyActivity[]
  }

  getInputActivity(startMs: number, endMs: number): InputRecord[] {
    return this.db
      .prepare(
        `
      SELECT recorded_at, key_count, click_count
      FROM input_counts
      WHERE recorded_at >= ? AND recorded_at < ?
      ORDER BY recorded_at ASC
    `,
      )
      .all(startMs, endMs) as InputRecord[]
  }

  getCategoryBreakdown(startMs: number, endMs: number): CategoryBreakdown[] {
    const now = Date.now()
    return this.db
      .prepare(
        `
      SELECT category, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY category
      HAVING total_ms >= 60000
      ORDER BY total_ms DESC
    `,
      )
      .all(now, endMs, startMs, endMs, startMs) as CategoryBreakdown[]
  }

  getAppBreakdown(startMs: number, endMs: number): AppBreakdown[] {
    const now = Date.now()
    return this.db
      .prepare(
        `
      SELECT app_name, category, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      HAVING total_ms >= 60000
      ORDER BY total_ms DESC
      LIMIT 20
    `,
      )
      .all(now, endMs, startMs, endMs, startMs) as AppBreakdown[]
  }

  getAppsByCategory(category: string, startMs: number, endMs: number): AppBreakdown[] {
    const now = Date.now()
    return this.db
      .prepare(
        `
      SELECT app_name, category, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE category = ? AND started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      HAVING total_ms >= 60000
      ORDER BY total_ms DESC
    `,
      )
      .all(now, endMs, startMs, category, endMs, startMs) as AppBreakdown[]
  }

  getTopApp(startMs: number, endMs: number): TopApp | undefined {
    const now = Date.now()
    return this.db
      .prepare(
        `
      SELECT app_name, SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL) AND is_idle = 0
      GROUP BY app_name
      ORDER BY total_ms DESC
      LIMIT 1
    `,
      )
      .get(now, endMs, startMs, endMs, startMs) as TopApp | undefined
  }

  getCallTimeByDay(startMs: number, endMs: number): CallTimeRecord[] {
    const now = Date.now()
    // Sessions are split at hour boundaries, so simple day grouping works
    return this.db
      .prepare(
        `
      SELECT
        app_name,
        strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
        SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM call_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      GROUP BY date, app_name
      HAVING total_ms >= 60000
      ORDER BY date ASC
    `,
      )
      .all(now, endMs, startMs, endMs, startMs) as CallTimeRecord[]
  }

  getEntertainmentTimeByDay(startMs: number, endMs: number): EntertainmentTimeRecord[] {
    const now = Date.now()
    // Combine foreground entertainment (from activity_sessions) with background
    // entertainment (from background_entertainment_sessions) into one result set
    return this.db
      .prepare(
        `
      SELECT app_name, date, SUM(total_ms) as total_ms FROM (
        SELECT
          app_name,
          strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
          MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) as total_ms
        FROM activity_sessions
        WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
          AND category = 'Entertainment' AND is_idle = 0
        UNION ALL
        SELECT
          app_name || ' (background)' as app_name,
          strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
          MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?) as total_ms
        FROM background_entertainment_sessions
        WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
      )
      GROUP BY date, app_name
      HAVING total_ms >= 60000
      ORDER BY date ASC
    `,
      )
      .all(now, endMs, startMs, endMs, startMs, now, endMs, startMs, endMs, startMs) as EntertainmentTimeRecord[]
  }

  getAiTimeByDay(startMs: number, endMs: number): AiTimeRecord[] {
    const now = Date.now()
    return this.db
      .prepare(
        `
      SELECT
        app_name,
        strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') as date,
        SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
        AND category = 'AI' AND is_idle = 0
      GROUP BY date, app_name
      HAVING total_ms >= 60000
      ORDER BY date ASC
    `,
      )
      .all(now, endMs, startMs, endMs, startMs) as AiTimeRecord[]
  }

  getProjectBreakdown(startMs: number, endMs: number): ProjectBreakdown[] {
    const now = Date.now()
    const rows = this.db
      .prepare(
        `
      SELECT app_name, window_title,
        SUM(MIN(COALESCE(ended_at, ?), ?) - MAX(started_at, ?)) as total_ms
      FROM activity_sessions
      WHERE started_at < ? AND (ended_at > ? OR ended_at IS NULL)
        AND is_idle = 0 AND category = 'Coding'
      GROUP BY app_name, window_title
      HAVING total_ms >= 60000
    `,
      )
      .all(now, endMs, startMs, endMs, startMs) as Array<{ app_name: string; window_title: string; total_ms: number }>

    // Aggregate by project name across different window titles
    const projectMap = new Map<string, number>()
    for (const row of rows) {
      const project = extractProjectName(row.app_name, row.window_title)
      if (!project) continue
      projectMap.set(project, (projectMap.get(project) || 0) + row.total_ms)
    }

    return [...projectMap.entries()]
      .map(([project, total_ms]) => ({ project, total_ms }))
      .sort((a, b) => b.total_ms - a.total_ms)
      .slice(0, 10)
  }
}

export { QueryEngine }
