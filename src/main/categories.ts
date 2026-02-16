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
  AI: ['Claude', 'ChatGPT', 'Ollama', 'LM Studio', 'Poe', 'GitHub Copilot', 'Codeium', 'Codex', 'Perplexity'],
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

// Maps a browser title pattern to a display-friendly app name.
// When a browser tab matches one of these patterns the session is stored
// with the service name (e.g. "YouTube") instead of the browser name
// (e.g. "Google Chrome") so charts can group and colour them correctly.
const BROWSER_TITLE_APP_NAMES: Record<string, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  midjourney: 'Midjourney',
  copilot: 'Copilot',
  'hugging face': 'Hugging Face',
  'poe.com': 'Poe',
  'google meet': 'Google Meet',
  'meet -': 'Google Meet',
  youtube: 'YouTube',
  netflix: 'Netflix',
  twitch: 'Twitch',
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

/**
 * When a browser tab matches a known service (YouTube, Claude, etc.),
 * return the service display name instead of the browser name.
 * Returns the original appName when there is no match.
 */
function resolveBrowserAppName(appName: string, windowTitle: string): string {
  if (!isBrowser(appName) || !windowTitle) return appName
  const titleLower = windowTitle.toLowerCase()
  for (const [pattern, displayName] of Object.entries(BROWSER_TITLE_APP_NAMES)) {
    if (titleLower.includes(pattern)) {
      return displayName
    }
  }
  return appName
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

// IDE families for project name extraction from window titles
const VSCODE_FAMILY = new Set(['Code', 'Visual Studio Code', 'Cursor', 'Windsurf', 'Sublime Text'])
const JETBRAINS_FAMILY = new Set([
  'WebStorm',
  'IntelliJ IDEA',
  'PyCharm',
  'GoLand',
  'CLion',
  'PhpStorm',
  'RubyMine',
  'DataGrip',
  'Fleet',
  'Android Studio',
])

function extractProjectName(appName: string, windowTitle: string): string | null {
  if (!windowTitle) return null

  // VS Code / Cursor / Windsurf / Sublime Text: "file - project - AppName"
  if (VSCODE_FAMILY.has(appName)) {
    // Strip [SSH: host] or [WSL: distro] suffixes before parsing
    let title = windowTitle.replace(/\s*\[.+?\]\s*/g, '')
    // Strip dirty indicators from start
    title = title.replace(/^[●*]\s*/, '')
    const parts = title.split(' - ')
    // Need at least 3 parts: file - project - AppName
    if (parts.length >= 3) {
      return parts[parts.length - 2].trim() || null
    }
    return null
  }

  // JetBrains IDEs: "project – file" (en-dash U+2013)
  if (JETBRAINS_FAMILY.has(appName)) {
    const parts = windowTitle.split(' \u2013 ')
    if (parts.length >= 1 && parts[0].trim()) {
      return parts[0].trim()
    }
    return null
  }

  // Zed: "file — project" (em-dash U+2014)
  if (appName === 'Zed') {
    const parts = windowTitle.split(' \u2014 ')
    if (parts.length >= 2) {
      return parts[parts.length - 1].trim() || null
    }
    return null
  }

  // Xcode, Vim, Neovim, Emacs — can't reliably extract project name
  return null
}

export {
  APP_CATEGORIES,
  extractProjectName,
  isBrowser,
  isFaceTimeCall,
  isGoogleMeet,
  isYouTube,
  resolveBrowserAppName,
  resolveCategory,
}
