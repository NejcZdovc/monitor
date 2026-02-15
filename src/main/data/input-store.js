class InputStore {
  constructor(db) {
    this.db = db
    this._insertStmt = db.prepare(`
      INSERT INTO input_counts (recorded_at, key_count, click_count)
      VALUES (@recordedAt, @keyCount, @clickCount)
    `)
  }

  insert(record) {
    this._insertStmt.run({
      recordedAt: record.recordedAt,
      keyCount: record.keyCount,
      clickCount: record.clickCount,
    })
  }
}

module.exports = { InputStore }
