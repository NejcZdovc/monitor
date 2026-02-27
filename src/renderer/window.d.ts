export interface SummaryTotals {
  activeTimeMs: number
  idleTimeMs: number
  totalKeys: number
  totalClicks: number
  callTimeMs: number
  entertainmentTimeMs: number
  aiTimeMs: number
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

export interface EntertainmentTimeRecord {
  app_name: string
  date: string
  total_ms: number
}

export interface AiTimeRecord {
  app_name: string
  date: string
  total_ms: number
}

export interface ProjectBreakdown {
  project: string
  total_ms: number
}

export interface HourlyAppBreakdown {
  app_name: string
  category: string
  total_ms: number
}

export interface TrayStats extends SummaryTotals {
  topApp: { app_name: string; total_ms: number } | null
  isTracking: boolean
}

export interface MonitorAPI {
  getSummary(startMs: number, endMs: number): Promise<SummaryTotals>
  getHourlyActivity(startMs: number, endMs: number): Promise<HourlyActivity[]>
  getDailyActivity(startMs: number, endMs: number): Promise<DailyActivity[]>
  getInputActivity(startMs: number, endMs: number): Promise<InputRecord[]>
  getCategoryBreakdown(startMs: number, endMs: number): Promise<CategoryBreakdown[]>
  getAppBreakdown(startMs: number, endMs: number): Promise<AppBreakdown[]>
  getAppsByCategory(category: string, startMs: number, endMs: number): Promise<AppBreakdown[]>
  getCallTime(startMs: number, endMs: number): Promise<CallTimeRecord[]>
  getEntertainmentTime(startMs: number, endMs: number): Promise<EntertainmentTimeRecord[]>
  getAiTime(startMs: number, endMs: number): Promise<AiTimeRecord[]>
  getProjectBreakdown(startMs: number, endMs: number): Promise<ProjectBreakdown[]>
  getAppsByHour(hourMs: number): Promise<HourlyAppBreakdown[]>
  getTrackingStatus(): Promise<{ isTracking: boolean }>
  toggleTracking(): Promise<{ isTracking: boolean }>
  isDev(): Promise<boolean>
  quitAndInstall(): Promise<void>
  onUpdateReady(callback: () => void): void
}

export interface TrayAPI {
  getStats(): Promise<TrayStats>
  openDashboard(): void
  closeDashboard(): void
  toggleTracking(): Promise<{ isTracking: boolean }>
  quit(): void
  onRefresh(callback: () => void): void
}

declare global {
  interface Window {
    monitor: MonitorAPI
    trayApi: TrayAPI
  }
}
