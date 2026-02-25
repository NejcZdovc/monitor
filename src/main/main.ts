import path from "node:path";
import { app, Menu, nativeImage, systemPreferences } from "electron";
import { checkForUpdates, checkForUpdatesSilently, initAutoUpdater } from "./auto-updater";
import { AppDatabase } from "./data/database";
import { QueryEngine } from "./data/query-engine";
import { registerIpcHandlers } from "./ipc-handlers";
import { TrackerManager } from "./tracking/tracker-manager";
import { createTray } from "./tray";
import { closeDashboardWindow, createDashboardWindow } from "./window-manager";

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Hide dock icon (menu bar app only)
if (app.dock) {
  app.dock.hide();
}

let database: AppDatabase | undefined;
let trackerManager: TrackerManager | undefined;
let queryEngine: QueryEngine | undefined;
let _tray: Electron.Tray | undefined;

app.on("second-instance", () => {
  createDashboardWindow();
});

app.whenReady().then(async () => {
  // Set dock icon
  if (app.dock) {
    const iconPath = path.join(__dirname, "../../assets/icon.png");
    app.dock.setIcon(nativeImage.createFromPath(iconPath));
  }

  // Prompt for accessibility (non-blocking, just triggers the macOS dialog)
  systemPreferences.isTrustedAccessibilityClient(true);

  // Initialize database
  database = new AppDatabase();
  database.cleanupOrphanedSessions();
  queryEngine = new QueryEngine(database.db);

  // Initialize tracker
  trackerManager = new TrackerManager(database);

  // Register IPC handlers
  registerIpcHandlers(queryEngine, trackerManager);

  // Start tracking (trackers individually check for permissions before starting)
  trackerManager.start();

  // Create tray icon
  _tray = createTray(
    trackerManager,
    queryEngine,
    () => {
      createDashboardWindow();
    },
    () => {
      closeDashboardWindow();
    },
  );

  // Set app menu (removes default Edit, File, Help menus)
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        {
          label: `About ${app.name}`,
          click: () => {
            app.showAboutPanel();
            checkForUpdatesSilently();
          },
        },
        { type: "separator" },
        {
          label: "Check for Updates...",
          click: () => checkForUpdates(),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Always show dashboard on startup
  createDashboardWindow();

  // Check for updates
  initAutoUpdater();
});

app.on("will-quit", () => {
  if (trackerManager) trackerManager.stop();
  if (database) database.close();
});

app.on("window-all-closed", () => {
  // Don't quit when windows are closed (tray app)
});
