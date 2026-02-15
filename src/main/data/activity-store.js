class ActivityStore {
  constructor(db) {
    this.db = db
    this._insertStmt = db.prepare(`
      INSERT INTO activity_sessions (app_name, window_title, category, started_at, ended_at, duration_ms, is_idle)
      VALUES (@appName, @windowTitle, @category, @startedAt, @endedAt, @durationMs, @isIdle)
    `)
    this._updateStmt = db.prepare(`
      UPDATE activity_sessions SET ended_at = @endedAt, duration_ms = @durationMs WHERE id = @id
    `)
  }

  insert(session) {
    const result = this._insertStmt.run({
      appName: session.appName,
      windowTitle: session.windowTitle,
      category: session.category,
      startedAt: session.startedAt,
      endedAt: session.endedAt || null,
      durationMs: session.durationMs || null,
      isIdle: session.isIdle ? 1 : 0,
    })
    return result.lastInsertRowid
  }

  update(id, endedAt) {
    const row = this.db.prepare('SELECT started_at FROM activity_sessions WHERE id = ?').get(id)
    if (!row) return
    // If endedAt is before startedAt (e.g., backdated idle), clamp to startedAt
    const clampedEndedAt = Math.max(endedAt, row.started_at)
    const durationMs = clampedEndedAt - row.started_at
    this._updateStmt.run({ id, endedAt: clampedEndedAt, durationMs })
  }
}

module.exports = { ActivityStore }
