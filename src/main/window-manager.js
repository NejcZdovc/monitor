const { BrowserWindow, screen } = require('electron');
const path = require('path');

let dashboardWindow = null;

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return dashboardWindow;
  }

  // Use full height to show all charts without scrolling, clamped to screen
  const DESIRED_WIDTH = 1100;
  const DESIRED_HEIGHT = 1450;
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const width = Math.min(DESIRED_WIDTH, workArea.width);
  const height = Math.min(DESIRED_HEIGHT, workArea.height);

  dashboardWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    title: 'Monitor',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  return dashboardWindow;
}

function closeDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.close();
  }
}

module.exports = { createDashboardWindow, closeDashboardWindow };
