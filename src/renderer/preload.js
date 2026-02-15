const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('monitor', {
  getSummary: (startMs, endMs) => ipcRenderer.invoke('get-summary', startMs, endMs),
  getHourlyActivity: (startMs, endMs) => ipcRenderer.invoke('get-hourly-activity', startMs, endMs),
  getDailyActivity: (startMs, endMs) => ipcRenderer.invoke('get-daily-activity', startMs, endMs),
  getInputActivity: (startMs, endMs) => ipcRenderer.invoke('get-input-activity', startMs, endMs),
  getCategoryBreakdown: (startMs, endMs) => ipcRenderer.invoke('get-category-breakdown', startMs, endMs),
  getAppBreakdown: (startMs, endMs) => ipcRenderer.invoke('get-app-breakdown', startMs, endMs),
  getAppsByCategory: (category, startMs, endMs) => ipcRenderer.invoke('get-apps-by-category', category, startMs, endMs),
  getCallTime: (startMs, endMs) => ipcRenderer.invoke('get-call-time', startMs, endMs),
  getYouTubeTime: (startMs, endMs) => ipcRenderer.invoke('get-youtube-time', startMs, endMs),
  getTrackingStatus: () => ipcRenderer.invoke('get-tracking-status'),
  toggleTracking: () => ipcRenderer.invoke('toggle-tracking'),
  isDev: () => ipcRenderer.invoke('is-dev'),
})
