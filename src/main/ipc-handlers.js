const { ipcMain, app } = require('electron')

function registerIpcHandlers(queryEngine, trackerManager) {
  ipcMain.handle('is-dev', () => {
    return !app.isPackaged
  })

  ipcMain.handle('get-summary', (_event, startMs, endMs) => {
    return queryEngine.getSummaryTotals(startMs, endMs)
  })

  ipcMain.handle('get-hourly-activity', (_event, startMs, endMs) => {
    return queryEngine.getHourlyActivity(startMs, endMs)
  })

  ipcMain.handle('get-daily-activity', (_event, startMs, endMs) => {
    return queryEngine.getDailyActivity(startMs, endMs)
  })

  ipcMain.handle('get-input-activity', (_event, startMs, endMs) => {
    return queryEngine.getInputActivity(startMs, endMs)
  })

  ipcMain.handle('get-category-breakdown', (_event, startMs, endMs) => {
    return queryEngine.getCategoryBreakdown(startMs, endMs)
  })

  ipcMain.handle('get-app-breakdown', (_event, startMs, endMs) => {
    return queryEngine.getAppBreakdown(startMs, endMs)
  })

  ipcMain.handle('get-apps-by-category', (_event, category, startMs, endMs) => {
    return queryEngine.getAppsByCategory(category, startMs, endMs)
  })

  ipcMain.handle('get-call-time', (_event, startMs, endMs) => {
    return queryEngine.getCallTimeByDay(startMs, endMs)
  })

  ipcMain.handle('get-youtube-time', (_event, startMs, endMs) => {
    return queryEngine.getYouTubeTimeByDay(startMs, endMs)
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

module.exports = { registerIpcHandlers }
