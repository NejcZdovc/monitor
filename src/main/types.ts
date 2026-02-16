export interface SummaryTotals {
  activeTimeMs: number
  idleTimeMs: number
  totalKeys: number
  totalClicks: number
  callTimeMs: number
  youtubeTimeMs: number
}

export interface HourlyActivity {
  hour: number
  active_ms: number
}

export interface DailyActivity {
  date: string
  active_ms: number
}

export interface InputRecord {
  recorded_at: number
  key_count: number
  click_count: number
}

export interface CategoryBreakdown {
  category: string
  total_ms: number
}

export interface AppBreakdown {
  app_name: string
  category: string
  total_ms: number
}

export interface CallTimeRecord {
  app_name: string
  date: string
  total_ms: number
}

export interface YouTubeTimeRecord {
  date: string
  total_ms: number
}

export interface TopApp {
  app_name: string
  total_ms: number
}

export interface ActivitySession {
  appName: string
  windowTitle: string
  category: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  isIdle: boolean
}

export interface CallSession {
  appName: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
}

export interface InputCountRecord {
  recordedAt: number
  keyCount: number
  clickCount: number
}

export interface TrackedSession {
  id: number
  appName: string
  windowTitle: string
  category: string
  startedAt: number
}

export interface CallSessionRef {
  id: number
  appName: string
  startedAt: number
}
