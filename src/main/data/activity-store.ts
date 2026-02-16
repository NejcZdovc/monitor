import type Database from 'better-sqlite3'
import type { Statement } from 'better-sqlite3'
import type { ActivitySession } from '../types'

class ActivityStore {
  db: Database.Database
  _insertStmt: Statement
  _updateStmt: Statement

  constructor(db: Database.Database) {
    this.db = db
    this._insertStmt = db.prepare(`
      INSERT INTO activity_sessions (app_name, window_title, category, started_at, ended_at, duration_ms, is_idle)
      VALUES (@appName, @windowTitle, @category, @startedAt, @endedAt, @durationMs, @isIdle)
    `)
    this._updateStmt = db.prepare(`
      UPDATE activity_sessions SET ended_at = @endedAt, duration_ms = @durationMs WHERE id = @id
    `)
  }

  insert(session: ActivitySession): number {
    const result = this._insertStmt.run({
      appName: session.appName,
      windowTitle: session.windowTitle,
      category: session.category,
      startedAt: session.startedAt,
      endedAt: session.endedAt || null,
      durationMs: session.durationMs || null,
      isIdle: session.isIdle ? 1 : 0,
    })
    return result.lastInsertRowid as number
  }

  update(id: number, endedAt: number) {
    const row = this.db.prepare('SELECT started_at FROM activity_sessions WHERE id = ?').get(id) as
      | { started_at: number }
      | undefined
    if (!row) return
    const clampedEndedAt = Math.max(endedAt, row.started_at)
    const durationMs = clampedEndedAt - row.started_at
    this._updateStmt.run({ id, endedAt: clampedEndedAt, durationMs })
  }
}

export { ActivityStore }
