import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('trayApi', {
  getStats: () => ipcRenderer.invoke('tray-get-stats'),
  openDashboard: () => ipcRenderer.send('tray-open-dashboard'),
  closeDashboard: () => ipcRenderer.send('tray-close-dashboard'),
  toggleTracking: () => ipcRenderer.invoke('tray-toggle-tracking'),
  quit: () => ipcRenderer.send('tray-quit'),
  quitAndInstall: () => ipcRenderer.invoke('app:quit-and-install'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  getPendingVersion: () => ipcRenderer.invoke('app:get-pending-version'),
  onRefresh: (callback: () => void) => {
    ipcRenderer.removeAllListeners('tray-refresh')
    ipcRenderer.on('tray-refresh', callback)
  },
  onUpdateReady: (callback: (version: string) => void) => {
    ipcRenderer.removeAllListeners('app:update-ready')
    ipcRenderer.on('app:update-ready', (_e, version: string) => callback(version))
  },
})
