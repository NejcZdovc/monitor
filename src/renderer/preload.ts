import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('monitor', {
  getSummary: (startMs: number, endMs: number) => ipcRenderer.invoke('get-summary', startMs, endMs),
  getHourlyActivity: (startMs: number, endMs: number) => ipcRenderer.invoke('get-hourly-activity', startMs, endMs),
  getDailyActivity: (startMs: number, endMs: number) => ipcRenderer.invoke('get-daily-activity', startMs, endMs),
  getInputActivity: (startMs: number, endMs: number) => ipcRenderer.invoke('get-input-activity', startMs, endMs),
  getCategoryBreakdown: (startMs: number, endMs: number) =>
    ipcRenderer.invoke('get-category-breakdown', startMs, endMs),
  getAppBreakdown: (startMs: number, endMs: number) => ipcRenderer.invoke('get-app-breakdown', startMs, endMs),
  getAppsByCategory: (category: string, startMs: number, endMs: number) =>
    ipcRenderer.invoke('get-apps-by-category', category, startMs, endMs),
  getCallTime: (startMs: number, endMs: number) => ipcRenderer.invoke('get-call-time', startMs, endMs),
  getYouTubeTime: (startMs: number, endMs: number) => ipcRenderer.invoke('get-youtube-time', startMs, endMs),
  getTrackingStatus: () => ipcRenderer.invoke('get-tracking-status'),
  toggleTracking: () => ipcRenderer.invoke('toggle-tracking'),
  isDev: () => ipcRenderer.invoke('is-dev'),
})
