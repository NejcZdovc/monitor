const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('trayApi', {
  getStats: () => ipcRenderer.invoke('tray-get-stats'),
  openDashboard: () => ipcRenderer.send('tray-open-dashboard'),
  closeDashboard: () => ipcRenderer.send('tray-close-dashboard'),
  toggleTracking: () => ipcRenderer.invoke('tray-toggle-tracking'),
  quit: () => ipcRenderer.send('tray-quit'),
  onRefresh: (callback) => ipcRenderer.on('tray-refresh', callback),
})
