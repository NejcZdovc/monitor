import { app, ipcMain } from 'electron'
import type { QueryEngine } from './data/query-engine'
import type { TrackerManager } from './tracking/tracker-manager'

function registerIpcHandlers(queryEngine: QueryEngine, trackerManager: TrackerManager) {
  ipcMain.handle('is-dev', () => {
    return !app.isPackaged
  })

  ipcMain.handle('get-summary', (_event, startMs: number, endMs: number) => {
    return queryEngine.getSummaryTotals(startMs, endMs)
  })

  ipcMain.handle('get-hourly-activity', (_event, startMs: number, endMs: number) => {
    return queryEngine.getHourlyActivity(startMs, endMs)
  })

  ipcMain.handle('get-daily-activity', (_event, startMs: number, endMs: number) => {
    return queryEngine.getDailyActivity(startMs, endMs)
  })

  ipcMain.handle('get-input-activity', (_event, startMs: number, endMs: number) => {
    return queryEngine.getInputActivity(startMs, endMs)
  })

  ipcMain.handle('get-category-breakdown', (_event, startMs: number, endMs: number) => {
    return queryEngine.getCategoryBreakdown(startMs, endMs)
  })

  ipcMain.handle('get-app-breakdown', (_event, startMs: number, endMs: number) => {
    return queryEngine.getAppBreakdown(startMs, endMs)
  })

  ipcMain.handle('get-apps-by-category', (_event, category: string, startMs: number, endMs: number) => {
    return queryEngine.getAppsByCategory(category, startMs, endMs)
  })

  ipcMain.handle('get-call-time', (_event, startMs: number, endMs: number) => {
    return queryEngine.getCallTimeByDay(startMs, endMs)
  })

  ipcMain.handle('get-entertainment-time', (_event, startMs: number, endMs: number) => {
    return queryEngine.getEntertainmentTimeByDay(startMs, endMs)
  })

  ipcMain.handle('get-ai-time', (_event, startMs: number, endMs: number) => {
    return queryEngine.getAiTimeByDay(startMs, endMs)
  })

  ipcMain.handle('get-project-breakdown', (_event, startMs: number, endMs: number) => {
    return queryEngine.getProjectBreakdown(startMs, endMs)
  })

  ipcMain.handle('get-tracking-status', () => {
    return { isTracking: trackerManager.isTracking }
  })

  ipcMain.handle('toggle-tracking', () => {
    if (trackerManager.isTracking) {
      trackerManager.stop()
    } else {
      trackerManager.start()
    }
    return { isTracking: trackerManager.isTracking }
  })
}

export { registerIpcHandlers }
