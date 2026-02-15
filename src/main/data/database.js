const Database = require('better-sqlite3')
const path = require('node:path')
const { app } = require('electron')

class AppDatabase {
  constructor() {
    const dbName = app.isPackaged ? 'monitor.db' : 'monitor-dev.db'
    const dbPath = path.join(app.getPath('userData'), dbName)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)')
    const row = this.db.prepare('SELECT MAX(version) as v FROM schema_version').get()
    const currentVersion = row?.v || 0

    const migrations = [this._v1.bind(this)]
    for (let i = currentVersion; i < migrations.length; i++) {
      migrations[i]()
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(i + 1)
    }
  }

  _v1() {
    this.db.exec(`
      CREATE TABLE activity_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        window_title TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Other',
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_ms INTEGER,
        is_idle INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_activity_started ON activity_sessions(started_at);
      CREATE INDEX idx_activity_category ON activity_sessions(category);
      CREATE INDEX idx_activity_app ON activity_sessions(app_name);

      CREATE TABLE input_counts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at INTEGER NOT NULL,
        key_count INTEGER NOT NULL DEFAULT 0,
        click_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_input_recorded ON input_counts(recorded_at);

      CREATE TABLE call_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_ms INTEGER
      );
      CREATE INDEX idx_call_started ON call_sessions(started_at);

      CREATE TABLE daily_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        total_active_ms INTEGER DEFAULT 0,
        total_idle_ms INTEGER DEFAULT 0,
        total_key_count INTEGER DEFAULT 0,
        total_click_count INTEGER DEFAULT 0,
        total_call_ms INTEGER DEFAULT 0,
        total_youtube_ms INTEGER DEFAULT 0,
        app_breakdown TEXT DEFAULT '{}',
        category_breakdown TEXT DEFAULT '{}'
      );
      CREATE UNIQUE INDEX idx_summary_date ON daily_summaries(date);
    `)
  }

  /**
   * Close any orphaned sessions (ended_at IS NULL) that were left open
   * from a previous run (e.g., app crash). Sets ended_at to started_at + 5s
   * as a reasonable estimate for the last poll interval.
   */
  cleanupOrphanedSessions() {
    const now = Date.now()
    // Close orphaned activity sessions: set ended_at to started_at + 5000ms (one poll interval)
    const activityResult = this.db
      .prepare(`
      UPDATE activity_sessions
      SET ended_at = started_at + 5000, duration_ms = 5000
      WHERE ended_at IS NULL AND started_at < ?
    `)
      .run(now - 30000) // Only fix sessions older than 30s (current session may be legitimately open)

    if (activityResult.changes > 0) {
      console.log(`Cleaned up ${activityResult.changes} orphaned activity sessions`)
    }

    // Close orphaned call sessions similarly
    const callResult = this.db
      .prepare(`
      UPDATE call_sessions
      SET ended_at = started_at + 5000, duration_ms = 5000
      WHERE ended_at IS NULL AND started_at < ?
    `)
      .run(now - 30000)

    if (callResult.changes > 0) {
      console.log(`Cleaned up ${callResult.changes} orphaned call sessions`)
    }
  }

  close() {
    this.db.close()
  }
}

module.exports = { AppDatabase }
