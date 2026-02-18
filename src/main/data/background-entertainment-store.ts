import type Database from 'better-sqlite3'
import type { Statement } from 'better-sqlite3'

interface BackgroundEntertainmentSession {
  appName: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
}

class BackgroundEntertainmentStore {
  db: Database.Database
  _insertStmt: Statement
  _updateStmt: Statement

  constructor(db: Database.Database) {
    this.db = db
    this._insertStmt = db.prepare(`
      INSERT INTO background_entertainment_sessions (app_name, started_at, ended_at, duration_ms)
      VALUES (@appName, @startedAt, @endedAt, @durationMs)
    `)
    this._updateStmt = db.prepare(`
      UPDATE background_entertainment_sessions SET ended_at = @endedAt, duration_ms = @durationMs WHERE id = @id
    `)
  }

  insert(session: BackgroundEntertainmentSession): number {
    const result = this._insertStmt.run({
      appName: session.appName,
      startedAt: session.startedAt,
      endedAt: session.endedAt || null,
      durationMs: session.durationMs || null,
    })
    return result.lastInsertRowid as number
  }

  update(id: number, endedAt: number, startedAt: number) {
    this._updateStmt.run({ id, endedAt, durationMs: endedAt - startedAt })
  }
}

export { BackgroundEntertainmentStore }
