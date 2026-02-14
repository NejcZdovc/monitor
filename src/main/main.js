const { app, BrowserWindow, systemPreferences } = require('electron');
const { AppDatabase } = require('./data/database');
const { QueryEngine } = require('./data/query-engine');
const { TrackerManager } = require('./tracking/tracker-manager');
const { registerIpcHandlers } = require('./ipc-handlers');
const { createTray } = require('./tray');
const { createDashboardWindow, closeDashboardWindow } = require('./window-manager');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Hide dock icon (menu bar app only)
if (app.dock) {
  app.dock.hide();
}

let database, trackerManager, queryEngine, tray;

app.on('second-instance', () => {
  createDashboardWindow();
});

app.whenReady().then(async () => {
  // Prompt for accessibility (non-blocking, just triggers the macOS dialog)
  systemPreferences.isTrustedAccessibilityClient(true);

  // Initialize database
  database = new AppDatabase();
  queryEngine = new QueryEngine(database.db);

  // Initialize tracker
  trackerManager = new TrackerManager(database);

  // Register IPC handlers
  registerIpcHandlers(queryEngine, trackerManager);

  // Start tracking (trackers individually check for permissions before starting)
  trackerManager.start();

  // Create tray icon
  tray = createTray(trackerManager, queryEngine, () => {
    createDashboardWindow();
  }, () => {
    closeDashboardWindow();
  });

  // Always show dashboard on startup
  createDashboardWindow();
});

app.on('will-quit', () => {
  if (trackerManager) trackerManager.stop();
  if (database) database.close();
});

app.on('window-all-closed', (e) => {
  // Don't quit when windows are closed (tray app)
});
