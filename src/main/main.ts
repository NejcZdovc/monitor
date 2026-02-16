import path from 'node:path'
import { app, nativeImage, systemPreferences } from 'electron'
import { updateElectronApp } from 'update-electron-app'
import { AppDatabase } from './data/database'
import { QueryEngine } from './data/query-engine'
import { registerIpcHandlers } from './ipc-handlers'
import { TrackerManager } from './tracking/tracker-manager'
import { createTray } from './tray'
import { closeDashboardWindow, createDashboardWindow } from './window-manager'

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// Hide dock icon (menu bar app only)
if (app.dock) {
  app.dock.hide()
}

// Auto-update only in packaged builds
if (app.isPackaged) {
  updateElectronApp({
    updateInterval: '1 hour',
    notifyUser: true,
  })
}

let database: AppDatabase | undefined
let trackerManager: TrackerManager | undefined
let queryEngine: QueryEngine | undefined
let _tray: Electron.Tray | undefined

app.on('second-instance', () => {
  createDashboardWindow()
})

app.whenReady().then(async () => {
  // Set dock icon
  if (app.dock) {
    const iconPath = path.join(__dirname, '../../assets/icon.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  // Prompt for accessibility (non-blocking, just triggers the macOS dialog)
  systemPreferences.isTrustedAccessibilityClient(true)

  // Initialize database
  database = new AppDatabase()
  database.cleanupOrphanedSessions()
  queryEngine = new QueryEngine(database.db)

  // Initialize tracker
  trackerManager = new TrackerManager(database)

  // Register IPC handlers
  registerIpcHandlers(queryEngine, trackerManager)

  // Start tracking (trackers individually check for permissions before starting)
  trackerManager.start()

  // Create tray icon
  _tray = createTray(
    trackerManager,
    queryEngine,
    () => {
      createDashboardWindow()
    },
    () => {
      closeDashboardWindow()
    },
  )

  // Always show dashboard on startup
  createDashboardWindow()
})

app.on('will-quit', () => {
  if (trackerManager) trackerManager.stop()
  if (database) database.close()
})

app.on('window-all-closed', () => {
  // Don't quit when windows are closed (tray app)
})
