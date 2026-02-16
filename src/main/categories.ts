const APP_CATEGORIES: Record<string, string[]> = {
  Coding: [
    'Visual Studio Code',
    'Code',
    'Cursor',
    'Sublime Text',
    'WebStorm',
    'IntelliJ IDEA',
    'PyCharm',
    'Xcode',
    'Android Studio',
    'Neovim',
    'Vim',
    'Emacs',
    'Atom',
    'Nova',
    'RubyMine',
    'GoLand',
    'CLion',
    'PhpStorm',
    'DataGrip',
    'Fleet',
    'Zed',
  ],
  Terminal: ['Terminal', 'iTerm2', 'iTerm', 'Warp', 'Ghostty', 'Alacritty', 'kitty', 'Hyper', 'Tabby', 'Rio'],
  AI: ['Claude', 'ChatGPT', 'Ollama', 'LM Studio', 'Poe', 'GitHub Copilot', 'Codeium', 'Codex'],
  Communication: [
    'Slack',
    'Mail',
    'Messages',
    'Discord',
    'Telegram',
    'WhatsApp',
    'Spark',
    'Mimestream',
    'Thunderbird',
    'Outlook',
    'Airmail',
  ],
  Meetings: ['zoom.us', 'Zoom', 'Microsoft Teams', 'Teams', 'FaceTime', 'Webex', 'Skype', 'Around', 'Loom'],
  Browsers: [
    'Brave Browser',
    'Google Chrome',
    'Safari',
    'Arc',
    'Firefox',
    'Microsoft Edge',
    'Opera',
    'Vivaldi',
    'Orion',
    'Chromium',
    'Zen Browser',
  ],
  Productivity: [
    'Finder',
    'Notes',
    'Calendar',
    'Reminders',
    'Preview',
    'TextEdit',
    'Numbers',
    'Pages',
    'Keynote',
    'Microsoft Word',
    'Microsoft Excel',
    'Microsoft PowerPoint',
    'Notion',
    'Obsidian',
    'Bear',
    'Craft',
    'Things',
    'Todoist',
    'TickTick',
    'Linear',
    'Figma',
    'Sketch',
    'Adobe Photoshop',
    'Adobe Illustrator',
    'Canva',
  ],
  DevTools: [
    'Tower',
    'Fork',
    'GitKraken',
    'Postman',
    'Insomnia',
    'Docker Desktop',
    'Docker',
    'TablePlus',
    'Sequel Pro',
    'pgAdmin',
    'MongoDB Compass',
    'Redis Insight',
    'Proxyman',
    'Charles',
  ],
  Entertainment: ['Music', 'Spotify', 'Podcasts', 'TV', 'VLC', 'IINA', 'Plex', 'Photos', 'QuickTime Player'],
  System: [
    'System Preferences',
    'System Settings',
    'Activity Monitor',
    'Disk Utility',
    'Console',
    'Keychain Access',
    'Migration Assistant',
    'Installer',
  ],
}

const BROWSER_TITLE_CATEGORIES: Record<string, string[]> = {
  AI: ['claude', 'chatgpt', 'gemini', 'perplexity', 'midjourney', 'copilot', 'hugging face', 'poe.com'],
  Meetings: ['google meet', 'meet -'],
  Entertainment: ['youtube', 'netflix', 'twitch'],
}

const BROWSER_APPS: Set<string> = new Set(APP_CATEGORIES.Browsers)

function resolveCategory(appName: string, windowTitle: string): string {
  if (isBrowser(appName) && windowTitle) {
    const titleLower = windowTitle.toLowerCase()
    for (const [category, patterns] of Object.entries(BROWSER_TITLE_CATEGORIES)) {
      if (patterns.some((p) => titleLower.includes(p))) {
        return category
      }
    }
    return 'Browsers'
  }
  for (const [category, apps] of Object.entries(APP_CATEGORIES)) {
    if (apps.some((app) => appName.includes(app) || app.includes(appName))) {
      return category
    }
  }
  return 'Other'
}

function isBrowser(appName: string): boolean {
  return BROWSER_APPS.has(appName) || APP_CATEGORIES.Browsers.some((b) => appName.includes(b) || b.includes(appName))
}

function isYouTube(appName: string, windowTitle: string): boolean {
  return isBrowser(appName) && !!windowTitle && windowTitle.toLowerCase().includes('youtube')
}

function isGoogleMeet(appName: string, windowTitle: string): boolean {
  if (!isBrowser(appName) || !windowTitle) return false
  const t = windowTitle.toLowerCase()
  return t.includes('google meet') || t.includes('meet -')
}

function isFaceTimeCall(appName: string): boolean {
  return appName === 'FaceTime'
}

export { APP_CATEGORIES, resolveCategory, isYouTube, isGoogleMeet, isFaceTimeCall, isBrowser }
