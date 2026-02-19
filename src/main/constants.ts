// ── Time durations ──────────────────────────────────────────────────────────

export const ONE_HOUR_MS = 3600000
export const ONE_MINUTE_MS = 60000
export const ONE_SECOND_MS = 1000

// ── Polling intervals ──────────────────────────────────────────────────────

export const WINDOW_POLL_INTERVAL_MS = 5000
export const YOUTUBE_POLL_INTERVAL_MS = 10000
export const IDLE_CHECK_INTERVAL_MS = 15000
export const CALL_CHECK_INTERVAL_MS = 15000
export const INPUT_FLUSH_INTERVAL_MS = 60000

// ── Timeouts ───────────────────────────────────────────────────────────────

export const OSASCRIPT_TIMEOUT_MS = 3000
export const YOUTUBE_OSASCRIPT_TIMEOUT_MS = 8000
export const PGREP_TIMEOUT_MS = 5000
export const SAFETY_TIMEOUT_MS = 10000
export const POLL_SAFETY_TIMEOUT_MS = 5000

// ── Idle detection ─────────────────────────────────────────────────────────

export const IDLE_THRESHOLD_SECONDS = 300
export const IDLE_RESUME_THRESHOLD_SECONDS = 10

// ── Orphaned session cleanup ───────────────────────────────────────────────

export const ORPHANED_SESSION_WINDOW_MS = 30000
export const ORPHANED_ACTIVITY_DURATION_MS = 5000
export const ORPHANED_BG_ENTERTAINMENT_DURATION_MS = 10000
