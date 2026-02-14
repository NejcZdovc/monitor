const { Tray, BrowserWindow, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');

let tray = null;
let popupWindow = null;
let ipcRegistered = false;

const POPUP_WIDTH = 260;
const POPUP_HEIGHT = 400;

function showPopup() {
  // Destroy and recreate every time for a clean state
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
    popupWindow = null;
  }

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  const screenBounds = display.workArea;
  if (x + POPUP_WIDTH > screenBounds.x + screenBounds.width) {
    x = screenBounds.x + screenBounds.width - POPUP_WIDTH;
  }
  if (x < screenBounds.x) {
    x = screenBounds.x;
  }

  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#1e1e1e',
    roundedCorners: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/tray-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  popupWindow.setAlwaysOnTop(true, 'pop-up-menu');

  popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
      popupWindow.hide();
    }
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
  });

  popupWindow.loadFile(path.join(__dirname, '../renderer/tray-popup.html'));

  popupWindow.webContents.once('did-finish-load', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.show();
      popupWindow.focus();
    }
  });
}

function togglePopup() {
  if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
    popupWindow.hide();
  } else {
    showPopup();
  }
}

function createTray(trackerManager, queryEngine, openDashboard, closeDashboard) {
  const iconPath = path.join(__dirname, '../../assets/iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('Monitor - Activity Tracker');

  tray.on('click', () => {
    togglePopup();
  });

  tray.on('right-click', () => {
    togglePopup();
  });

  if (!ipcRegistered) {
    ipcRegistered = true;

    ipcMain.handle('tray-get-stats', () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const end = start + 86400000;

      let summary, topApp;
      try {
        summary = queryEngine.getSummaryTotals(start, end);
        topApp = queryEngine.getTopApp(start, end);
      } catch (err) {
        summary = { activeTimeMs: 0, totalKeys: 0, totalClicks: 0, callTimeMs: 0, youtubeTimeMs: 0 };
        topApp = null;
      }

      return {
        ...summary,
        topApp,
        isTracking: trackerManager.isTracking
      };
    });

    ipcMain.on('tray-open-dashboard', () => {
      if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) popupWindow.hide();
      setImmediate(() => openDashboard());
    });

    ipcMain.on('tray-close-dashboard', () => {
      if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) popupWindow.hide();
      closeDashboard();
    });

    ipcMain.handle('tray-toggle-tracking', () => {
      if (trackerManager.isTracking) {
        trackerManager.stop();
      } else {
        trackerManager.start();
      }
      return { isTracking: trackerManager.isTracking };
    });

    ipcMain.on('tray-quit', () => {
      const { app } = require('electron');
      app.quit();
    });
  }

  return tray;
}

module.exports = { createTray };
