class CallStore {
  constructor(db) {
    this.db = db
    this._insertStmt = db.prepare(`
      INSERT INTO call_sessions (app_name, started_at, ended_at, duration_ms)
      VALUES (@appName, @startedAt, @endedAt, @durationMs)
    `)
    this._updateStmt = db.prepare(`
      UPDATE call_sessions SET ended_at = @endedAt, duration_ms = @durationMs WHERE id = @id
    `)
  }

  insert(session) {
    const result = this._insertStmt.run({
      appName: session.appName,
      startedAt: session.startedAt,
      endedAt: session.endedAt || null,
      durationMs: session.durationMs || null,
    })
    return result.lastInsertRowid
  }

  update(id, endedAt, startedAt) {
    this._updateStmt.run({ id, endedAt, durationMs: endedAt - startedAt })
  }
}

module.exports = { CallStore }
