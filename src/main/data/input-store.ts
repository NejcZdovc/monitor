import type Database from 'better-sqlite3'
import type { Statement } from 'better-sqlite3'
import type { InputCountRecord } from '../types'

class InputStore {
  db: Database.Database
  _insertStmt: Statement

  constructor(db: Database.Database) {
    this.db = db
    this._insertStmt = db.prepare(`
      INSERT INTO input_counts (recorded_at, key_count, click_count)
      VALUES (@recordedAt, @keyCount, @clickCount)
    `)
  }

  insert(record: InputCountRecord) {
    this._insertStmt.run({
      recordedAt: record.recordedAt,
      keyCount: record.keyCount,
      clickCount: record.clickCount,
    })
  }
}

export { InputStore }
