const APP_CATEGORIES = {
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

// Browser window title patterns for special detection
const BROWSER_TITLE_CATEGORIES = {
  AI: ['claude', 'chatgpt', 'gemini', 'perplexity', 'midjourney', 'copilot', 'hugging face', 'poe.com'],
  Meetings: ['google meet', 'meet -'],
  Entertainment: ['youtube', 'netflix', 'twitch'],
}

const BROWSER_APPS = new Set(APP_CATEGORIES.Browsers)

function resolveCategory(appName, windowTitle) {
  // Check browser title patterns first (more specific than app category)
  if (isBrowser(appName) && windowTitle) {
    const titleLower = windowTitle.toLowerCase()

    for (const [category, patterns] of Object.entries(BROWSER_TITLE_CATEGORIES)) {
      if (patterns.some((p) => titleLower.includes(p))) {
        return category
      }
    }

    // Browser without special content
    return 'Browsers'
  }

  // Check app name against categories
  for (const [category, apps] of Object.entries(APP_CATEGORIES)) {
    if (apps.some((app) => appName.includes(app) || app.includes(appName))) {
      return category
    }
  }

  return 'Other'
}

function isBrowser(appName) {
  return BROWSER_APPS.has(appName) || APP_CATEGORIES.Browsers.some((b) => appName.includes(b) || b.includes(appName))
}

function isYouTube(appName, windowTitle) {
  return isBrowser(appName) && windowTitle && windowTitle.toLowerCase().includes('youtube')
}

function isGoogleMeet(appName, windowTitle) {
  if (!isBrowser(appName) || !windowTitle) return false
  const t = windowTitle.toLowerCase()
  return t.includes('google meet') || t.includes('meet -')
}

function isFaceTimeCall(appName) {
  return appName === 'FaceTime'
}

module.exports = { APP_CATEGORIES, resolveCategory, isYouTube, isGoogleMeet, isFaceTimeCall, isBrowser }
