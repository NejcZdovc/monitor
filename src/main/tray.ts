import path from 'node:path'
import { app, BrowserWindow, ipcMain, nativeImage, screen, Tray } from 'electron'
import type { QueryEngine } from './data/query-engine'
import type { TrackerManager } from './tracking/tracker-manager'
import type { SummaryTotals, TopApp } from './types'

declare const TRAY_POPUP_VITE_DEV_SERVER_URL: string | undefined

let tray: Tray | null = null
let popupWindow: BrowserWindow | null = null
let ipcRegistered = false

const POPUP_WIDTH = 260
const POPUP_HEIGHT = 414

function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
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
      preload: path.join(__dirname, 'tray-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.setAlwaysOnTop(true, 'pop-up-menu')

  win.on('blur', () => {
    if (!win.isDestroyed() && win.isVisible()) {
      win.hide()
    }
  })

  win.on('closed', () => {
    popupWindow = null
  })

  if (TRAY_POPUP_VITE_DEV_SERVER_URL) {
    win.loadURL(`${TRAY_POPUP_VITE_DEV_SERVER_URL}/tray_popup/index.html`)
  } else {
    win.loadFile(path.join(__dirname, `../renderer/tray_popup/tray_popup/index.html`))
  }

  return win
}

function positionPopup(win: BrowserWindow) {
  const trayBounds = tray!.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  const screenBounds = display.workArea
  if (x + POPUP_WIDTH > screenBounds.x + screenBounds.width) {
    x = screenBounds.x + screenBounds.width - POPUP_WIDTH
  }
  if (x < screenBounds.x) {
    x = screenBounds.x
  }

  win.setPosition(x, y)
}

function showPopup() {
  // Reuse existing window — only create once
  if (!popupWindow || popupWindow.isDestroyed()) {
    popupWindow = createPopupWindow()
    popupWindow.webContents.once('did-finish-load', () => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        positionPopup(popupWindow)
        popupWindow.show()
        popupWindow.focus()
      }
    })
    return
  }

  // Window exists — reposition, signal refresh, and show
  positionPopup(popupWindow)
  popupWindow.webContents.send('tray-refresh')
  popupWindow.show()
  popupWindow.focus()
}

function togglePopup() {
  if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
    popupWindow.hide()
  } else {
    showPopup()
  }
}

function createTray(
  trackerManager: TrackerManager,
  queryEngine: QueryEngine,
  openDashboard: () => void,
  closeDashboard: () => void,
): Tray {
  const iconPath = path.join(__dirname, '../../assets/iconTemplate.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)
  tray.setToolTip('Monitor - Activity Tracker')

  tray.on('click', () => {
    togglePopup()
  })

  tray.on('right-click', () => {
    togglePopup()
  })

  if (!ipcRegistered) {
    ipcRegistered = true

    ipcMain.handle('tray-get-stats', () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const end = start + 86400000

      let summary: SummaryTotals
      let topApp: TopApp | undefined
      try {
        summary = queryEngine.getSummaryTotals(start, end)
        topApp = queryEngine.getTopApp(start, end)
      } catch (_err) {
        summary = {
          activeTimeMs: 0,
          idleTimeMs: 0,
          totalKeys: 0,
          totalClicks: 0,
          callTimeMs: 0,
          entertainmentTimeMs: 0,
          aiTimeMs: 0,
        }
        topApp = undefined
      }

      return {
        ...summary,
        topApp,
        isTracking: trackerManager.isTracking,
      }
    })

    ipcMain.on('tray-open-dashboard', () => {
      if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) popupWindow.hide()
      setImmediate(() => openDashboard())
    })

    ipcMain.on('tray-close-dashboard', () => {
      if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) popupWindow.hide()
      closeDashboard()
    })

    ipcMain.handle('tray-toggle-tracking', () => {
      if (trackerManager.isTracking) {
        trackerManager.stop()
      } else {
        trackerManager.start()
      }
      return { isTracking: trackerManager.isTracking }
    })

    ipcMain.on('tray-quit', () => {
      app.quit()
    })
  }

  return tray
}

export { createTray }
