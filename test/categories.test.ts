/**
 * Tests for category resolution, browser detection, app name mapping,
 * and project name extraction from window titles.
 */

import {
  APP_CATEGORIES,
  extractProjectName,
  isBrowser,
  isFaceTimeCall,
  isGoogleMeet,
  isTerminal,
  isYouTube,
  resolveBrowserAppName,
  resolveCategory,
  resolveTerminalAppName,
} from '../src/main/categories'

// ── APP_CATEGORIES constant ───────────────────────────────────────────────

describe('APP_CATEGORIES', () => {
  test('has all expected category groups', () => {
    const expected = [
      'Coding',
      'Terminal',
      'AI',
      'Communication',
      'Meetings',
      'Browsers',
      'Productivity',
      'DevTools',
      'Entertainment',
      'System',
    ]
    for (const cat of expected) {
      expect(APP_CATEGORIES).toHaveProperty(cat)
      expect(APP_CATEGORIES[cat].length).toBeGreaterThan(0)
    }
  })

  test('every entry is a non-empty string', () => {
    for (const [, apps] of Object.entries(APP_CATEGORIES)) {
      for (const app of apps) {
        expect(typeof app).toBe('string')
        expect(app.length).toBeGreaterThan(0)
      }
    }
  })

  test('no app appears in multiple categories', () => {
    const seen = new Map<string, string>()
    for (const [category, apps] of Object.entries(APP_CATEGORIES)) {
      for (const app of apps) {
        const lower = app.toLowerCase()
        expect(seen.has(lower)).toBe(false)
        seen.set(lower, category)
      }
    }
  })
})

// ── isBrowser ─────────────────────────────────────────────────────────────

describe('isBrowser', () => {
  test('recognizes all listed browsers', () => {
    for (const browser of APP_CATEGORIES.Browsers) {
      expect(isBrowser(browser)).toBe(true)
    }
  })

  test('returns false for non-browser apps', () => {
    expect(isBrowser('Code')).toBe(false)
    expect(isBrowser('Slack')).toBe(false)
    expect(isBrowser('Zoom')).toBe(false)
    expect(isBrowser('Terminal')).toBe(false)
    expect(isBrowser('Finder')).toBe(false)
  })

  test('is case-insensitive', () => {
    expect(isBrowser('google chrome')).toBe(true)
    expect(isBrowser('SAFARI')).toBe(true)
    expect(isBrowser('brave browser')).toBe(true)
  })

  test('handles underscore variants', () => {
    expect(isBrowser('brave_browser')).toBe(true)
    expect(isBrowser('google_chrome')).toBe(true)
    expect(isBrowser('zen_browser')).toBe(true)
  })

  test('returns false for empty string', () => {
    expect(isBrowser('')).toBe(false)
  })

  test('returns false for unknown apps', () => {
    expect(isBrowser('RandomBrowser')).toBe(false)
    expect(isBrowser('Netscape')).toBe(false)
  })
})

// ── isTerminal ────────────────────────────────────────────────────────────

describe('isTerminal', () => {
  test('recognizes all listed terminal apps', () => {
    for (const terminal of APP_CATEGORIES.Terminal) {
      expect(isTerminal(terminal)).toBe(true)
    }
  })

  test('returns false for non-terminal apps', () => {
    expect(isTerminal('Code')).toBe(false)
    expect(isTerminal('Google Chrome')).toBe(false)
    expect(isTerminal('Slack')).toBe(false)
  })

  test('is case-insensitive', () => {
    expect(isTerminal('iterm2')).toBe(true)
    expect(isTerminal('TERMINAL')).toBe(true)
    expect(isTerminal('ghostty')).toBe(true)
  })

  test('handles underscore variants', () => {
    expect(isTerminal('i_term2')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isTerminal('')).toBe(false)
  })
})

// ── isYouTube ─────────────────────────────────────────────────────────────

describe('isYouTube', () => {
  test('detects YouTube in browser window title', () => {
    expect(isYouTube('Google Chrome', 'YouTube - Funny Video')).toBe(true)
    expect(isYouTube('Safari', 'Watch YouTube')).toBe(true)
    expect(isYouTube('Arc', 'youtube.com')).toBe(true)
  })

  test('is case-insensitive on title', () => {
    expect(isYouTube('Google Chrome', 'YOUTUBE - Home')).toBe(true)
    expect(isYouTube('Safari', 'youTube music')).toBe(true)
  })

  test('returns false for non-browser apps with YouTube title', () => {
    expect(isYouTube('Code', 'youtube-player.ts')).toBe(false)
    expect(isYouTube('Slack', 'YouTube link shared')).toBe(false)
  })

  test('returns false when no title', () => {
    expect(isYouTube('Google Chrome', '')).toBe(false)
  })

  test('returns false for browser without YouTube in title', () => {
    expect(isYouTube('Safari', 'Google Search')).toBe(false)
    expect(isYouTube('Arc', 'GitHub - PR #123')).toBe(false)
  })
})

// ── isGoogleMeet ──────────────────────────────────────────────────────────

describe('isGoogleMeet', () => {
  test('detects "Google Meet" in browser title', () => {
    expect(isGoogleMeet('Google Chrome', 'Google Meet - abc-defg-hij')).toBe(true)
    expect(isGoogleMeet('Safari', 'Google Meet')).toBe(true)
  })

  test('detects "Meet -" pattern in browser title', () => {
    expect(isGoogleMeet('Arc', 'Meet - abc-defg-hij')).toBe(true)
  })

  test('is case-insensitive', () => {
    expect(isGoogleMeet('Google Chrome', 'GOOGLE MEET - call')).toBe(true)
    expect(isGoogleMeet('Safari', 'google meet')).toBe(true)
  })

  test('returns false for non-browser apps', () => {
    expect(isGoogleMeet('Zoom', 'Google Meet')).toBe(false)
    expect(isGoogleMeet('Slack', 'Meet - channel')).toBe(false)
  })

  test('returns false when no title', () => {
    expect(isGoogleMeet('Google Chrome', '')).toBe(false)
  })

  test('returns false for unrelated browser titles', () => {
    expect(isGoogleMeet('Safari', 'Gmail - Inbox')).toBe(false)
    expect(isGoogleMeet('Chrome', 'Calendar')).toBe(false)
  })
})

// ── isFaceTimeCall ────────────────────────────────────────────────────────

describe('isFaceTimeCall', () => {
  test('returns true for FaceTime', () => {
    expect(isFaceTimeCall('FaceTime')).toBe(true)
  })

  test('returns false for other apps', () => {
    expect(isFaceTimeCall('Zoom')).toBe(false)
    expect(isFaceTimeCall('facetime')).toBe(false)
    expect(isFaceTimeCall('FaceTime Audio')).toBe(false)
    expect(isFaceTimeCall('')).toBe(false)
  })
})

// ── resolveCategory ───────────────────────────────────────────────────────

describe('resolveCategory', () => {
  describe('direct app categories', () => {
    test('resolves Coding apps', () => {
      expect(resolveCategory('Code', '')).toBe('Coding')
      expect(resolveCategory('Cursor', '')).toBe('Coding')
      expect(resolveCategory('Xcode', '')).toBe('Coding')
      expect(resolveCategory('WebStorm', '')).toBe('Coding')
      expect(resolveCategory('Zed', '')).toBe('Coding')
    })

    test('resolves Terminal apps', () => {
      expect(resolveCategory('Terminal', '')).toBe('Terminal')
      expect(resolveCategory('iTerm2', '')).toBe('Terminal')
      expect(resolveCategory('Warp', '')).toBe('Terminal')
      expect(resolveCategory('Ghostty', '')).toBe('Terminal')
    })

    test('resolves AI apps', () => {
      expect(resolveCategory('Claude', '')).toBe('AI')
      expect(resolveCategory('ChatGPT', '')).toBe('AI')
      expect(resolveCategory('Perplexity', '')).toBe('AI')
    })

    test('resolves Communication apps', () => {
      expect(resolveCategory('Slack', '')).toBe('Communication')
      expect(resolveCategory('Discord', '')).toBe('Communication')
      expect(resolveCategory('Messages', '')).toBe('Communication')
    })

    test('resolves Meetings apps', () => {
      expect(resolveCategory('Zoom', '')).toBe('Meetings')
      expect(resolveCategory('FaceTime', '')).toBe('Meetings')
      expect(resolveCategory('Microsoft Teams', '')).toBe('Meetings')
    })

    test('resolves Productivity apps', () => {
      expect(resolveCategory('Finder', '')).toBe('Productivity')
      expect(resolveCategory('Notion', '')).toBe('Productivity')
      expect(resolveCategory('Figma', '')).toBe('Productivity')
    })

    test('resolves DevTools apps', () => {
      expect(resolveCategory('Tower', '')).toBe('DevTools')
      expect(resolveCategory('Postman', '')).toBe('DevTools')
      expect(resolveCategory('TablePlus', '')).toBe('DevTools')
    })

    test('resolves Entertainment apps', () => {
      expect(resolveCategory('Spotify', '')).toBe('Entertainment')
      expect(resolveCategory('Music', '')).toBe('Entertainment')
    })

    test('resolves System apps', () => {
      expect(resolveCategory('System Settings', '')).toBe('System')
      expect(resolveCategory('Activity Monitor', '')).toBe('System')
    })

    test('returns Other for unknown apps', () => {
      expect(resolveCategory('SomeRandomApp', '')).toBe('Other')
      expect(resolveCategory('MyCustomTool', 'Window')).toBe('Other')
    })
  })

  describe('case insensitivity', () => {
    test('resolves apps case-insensitively', () => {
      expect(resolveCategory('code', '')).toBe('Coding')
      expect(resolveCategory('SLACK', '')).toBe('Communication')
      expect(resolveCategory('spotify', '')).toBe('Entertainment')
    })
  })

  describe('underscore normalization', () => {
    test('treats underscores as spaces', () => {
      expect(resolveCategory('Visual_Studio_Code', '')).toBe('Coding')
      expect(resolveCategory('Microsoft_Teams', '')).toBe('Meetings')
      expect(resolveCategory('System_Settings', '')).toBe('System')
    })
  })

  describe('browser title-based categories', () => {
    test('detects AI sites in browser', () => {
      expect(resolveCategory('Google Chrome', 'Claude - Chat')).toBe('AI')
      expect(resolveCategory('Safari', 'ChatGPT - Conversation')).toBe('AI')
      expect(resolveCategory('Arc', 'Perplexity - Search')).toBe('AI')
      expect(resolveCategory('Firefox', 'Gemini')).toBe('AI')
      expect(resolveCategory('Brave Browser', 'Copilot')).toBe('AI')
    })

    test('detects Meetings sites in browser', () => {
      expect(resolveCategory('Google Chrome', 'Google Meet - abc')).toBe('Meetings')
      expect(resolveCategory('Safari', 'Meet - xyz')).toBe('Meetings')
    })

    test('detects Entertainment sites in browser', () => {
      expect(resolveCategory('Google Chrome', 'YouTube - Video')).toBe('Entertainment')
      expect(resolveCategory('Safari', 'Netflix - Watch')).toBe('Entertainment')
      expect(resolveCategory('Arc', 'Twitch - Stream')).toBe('Entertainment')
    })

    test('defaults to Browsers for non-matching browser titles', () => {
      expect(resolveCategory('Google Chrome', 'GitHub - PR')).toBe('Browsers')
      expect(resolveCategory('Safari', 'Apple Store')).toBe('Browsers')
      expect(resolveCategory('Arc', 'Some Random Site')).toBe('Browsers')
    })

    test('defaults to Browsers for browsers with empty title', () => {
      // When a browser has empty title, isBrowser is true but title matching
      // falls through — however resolveCategory checks `windowTitle` is truthy
      // before entering browser-title matching, so it falls to APP_CATEGORY_MAP
      expect(resolveCategory('Google Chrome', '')).toBe('Browsers')
      expect(resolveCategory('Safari', '')).toBe('Browsers')
    })
  })

  describe('terminal title-based categories', () => {
    test('detects Claude Code in terminal as AI', () => {
      expect(resolveCategory('iTerm2', '⠐ Claude Code')).toBe('AI')
      expect(resolveCategory('Terminal', 'claude code')).toBe('AI')
      expect(resolveCategory('Warp', 'Claude Code — ~/Work/monitor')).toBe('AI')
      expect(resolveCategory('Ghostty', 'CLAUDE CODE')).toBe('AI')
    })

    test('defaults to Terminal for non-matching terminal titles', () => {
      expect(resolveCategory('iTerm2', 'bash — ~/Work')).toBe('Terminal')
      expect(resolveCategory('Terminal', 'vim main.ts')).toBe('Terminal')
      expect(resolveCategory('Warp', 'npm start')).toBe('Terminal')
    })

    test('defaults to Terminal for terminals with empty title', () => {
      expect(resolveCategory('iTerm2', '')).toBe('Terminal')
      expect(resolveCategory('Terminal', '')).toBe('Terminal')
    })
  })
})

// ── resolveBrowserAppName ─────────────────────────────────────────────────

describe('resolveBrowserAppName', () => {
  test('maps YouTube in browser to YouTube', () => {
    expect(resolveBrowserAppName('Google Chrome', 'YouTube - Funny Video')).toBe('YouTube')
    expect(resolveBrowserAppName('Safari', 'YouTube Music')).toBe('YouTube')
  })

  test('maps Claude in browser to Claude', () => {
    expect(resolveBrowserAppName('Google Chrome', 'Claude - Chat')).toBe('Claude')
    expect(resolveBrowserAppName('Arc', 'Claude.ai')).toBe('Claude')
  })

  test('maps ChatGPT in browser to ChatGPT', () => {
    expect(resolveBrowserAppName('Safari', 'ChatGPT - Conversation')).toBe('ChatGPT')
  })

  test('maps Google Meet in browser to Google Meet', () => {
    expect(resolveBrowserAppName('Google Chrome', 'Google Meet - call')).toBe('Google Meet')
    expect(resolveBrowserAppName('Arc', 'Meet - abc-def')).toBe('Google Meet')
  })

  test('maps Netflix in browser to Netflix', () => {
    expect(resolveBrowserAppName('Google Chrome', 'Netflix - Movie')).toBe('Netflix')
  })

  test('maps Twitch in browser to Twitch', () => {
    expect(resolveBrowserAppName('Safari', 'Twitch - StreamerName')).toBe('Twitch')
  })

  test('maps Perplexity in browser to Perplexity', () => {
    expect(resolveBrowserAppName('Arc', 'Perplexity AI - Search')).toBe('Perplexity')
  })

  test('returns original app name for non-matching browser titles', () => {
    expect(resolveBrowserAppName('Google Chrome', 'GitHub - PR')).toBe('Google Chrome')
    expect(resolveBrowserAppName('Safari', 'Apple.com')).toBe('Safari')
  })

  test('returns original app name for non-browser apps', () => {
    expect(resolveBrowserAppName('Code', 'youtube-player.ts')).toBe('Code')
    expect(resolveBrowserAppName('Slack', 'Claude message')).toBe('Slack')
  })

  test('returns original app name when title is empty', () => {
    expect(resolveBrowserAppName('Google Chrome', '')).toBe('Google Chrome')
  })

  test('is case-insensitive on title matching', () => {
    expect(resolveBrowserAppName('Google Chrome', 'YOUTUBE - Home')).toBe('YouTube')
    expect(resolveBrowserAppName('Safari', 'NETFLIX - show')).toBe('Netflix')
  })
})

// ── resolveTerminalAppName ────────────────────────────────────────────────

describe('resolveTerminalAppName', () => {
  test('maps Claude Code in terminal to Claude Code', () => {
    expect(resolveTerminalAppName('iTerm2', '⠐ Claude Code')).toBe('Claude Code')
    expect(resolveTerminalAppName('Terminal', 'claude code')).toBe('Claude Code')
    expect(resolveTerminalAppName('Warp', 'Claude Code — ~/Work')).toBe('Claude Code')
  })

  test('is case-insensitive on title matching', () => {
    expect(resolveTerminalAppName('iTerm2', 'CLAUDE CODE')).toBe('Claude Code')
    expect(resolveTerminalAppName('Ghostty', 'Claude code')).toBe('Claude Code')
  })

  test('returns original app name for non-matching terminal titles', () => {
    expect(resolveTerminalAppName('iTerm2', 'bash — ~/Work')).toBe('iTerm2')
    expect(resolveTerminalAppName('Terminal', 'vim main.ts')).toBe('Terminal')
  })

  test('returns original app name for non-terminal apps', () => {
    expect(resolveTerminalAppName('Code', 'Claude Code')).toBe('Code')
    expect(resolveTerminalAppName('Google Chrome', 'Claude Code')).toBe('Google Chrome')
  })

  test('returns original app name when title is empty', () => {
    expect(resolveTerminalAppName('iTerm2', '')).toBe('iTerm2')
  })
})

// ── extractProjectName ────────────────────────────────────────────────────

describe('extractProjectName', () => {
  describe('VS Code family', () => {
    test('extracts project from "file - project - Code" pattern', () => {
      expect(extractProjectName('Code', 'main.ts - monitor - Visual Studio Code')).toBe('monitor')
      expect(extractProjectName('Code', 'index.html - my-app - Visual Studio Code')).toBe('my-app')
    })

    test('extracts project from VS Code with workspace', () => {
      expect(extractProjectName('Visual Studio Code', 'file.ts - workspace - Visual Studio Code')).toBe('workspace')
    })

    test('extracts project from Sublime Text', () => {
      expect(extractProjectName('Sublime Text', 'file.py - project - Sublime Text')).toBe('project')
    })

    test('strips [SSH: host] suffix', () => {
      expect(extractProjectName('Code', 'main.ts - remote-project - Code [SSH: myhost]')).toBe('remote-project')
    })

    test('strips [WSL: distro] suffix', () => {
      expect(extractProjectName('Code', 'file.ts - wsl-project - Code [WSL: Ubuntu]')).toBe('wsl-project')
    })

    test('strips dirty indicator ●', () => {
      expect(extractProjectName('Code', '● main.ts - dirty-project - Code')).toBe('dirty-project')
    })

    test('strips dirty indicator *', () => {
      expect(extractProjectName('Code', '* main.ts - dirty-project - Code')).toBe('dirty-project')
    })

    test('returns null for simple title without project', () => {
      expect(extractProjectName('Code', 'Welcome')).toBeNull()
      expect(extractProjectName('Code', 'Settings')).toBeNull()
    })

    test('returns null for title with only two parts', () => {
      expect(extractProjectName('Code', 'file.ts - Code')).toBeNull()
    })

    test('handles underscore variant', () => {
      expect(extractProjectName('Visual_Studio_Code', 'main.ts - project - VS Code')).toBe('project')
    })
  })

  describe('Cursor / Zed family (em-dash)', () => {
    test('extracts project from "file — project" pattern', () => {
      expect(extractProjectName('Cursor', 'main.ts \u2014 monitor')).toBe('monitor')
      expect(extractProjectName('Zed', 'index.html \u2014 my-app')).toBe('my-app')
    })

    test('returns null without em-dash', () => {
      expect(extractProjectName('Cursor', 'Welcome')).toBeNull()
      expect(extractProjectName('Zed', 'Settings')).toBeNull()
    })

    test('handles multiple em-dashes (takes last)', () => {
      expect(extractProjectName('Cursor', 'long - file.ts \u2014 nested \u2014 project')).toBe('project')
    })
  })

  describe('JetBrains family (en-dash)', () => {
    test('extracts project from "project – file" pattern', () => {
      expect(extractProjectName('WebStorm', 'my-app \u2013 src/main.ts')).toBe('my-app')
      expect(extractProjectName('IntelliJ IDEA', 'backend \u2013 Main.java')).toBe('backend')
    })

    test('works for all JetBrains IDEs', () => {
      const ides = ['WebStorm', 'PyCharm', 'GoLand', 'CLion', 'PhpStorm', 'RubyMine', 'DataGrip', 'Fleet']
      for (const ide of ides) {
        expect(extractProjectName(ide, 'project \u2013 file.ts')).toBe('project')
      }
    })

    test('returns entire title as project when no en-dash present', () => {
      // When there's no en-dash, split returns the full title as parts[0]
      // which is treated as the project name — this matches current behavior
      expect(extractProjectName('WebStorm', 'Welcome to WebStorm')).toBe('Welcome to WebStorm')
    })

    test('handles underscore in IDE name', () => {
      expect(extractProjectName('intellij_idea', 'project \u2013 file.java')).toBe('project')
    })
  })

  describe('unsupported IDEs', () => {
    test('returns null for Xcode', () => {
      expect(extractProjectName('Xcode', 'MyApp.xcodeproj')).toBeNull()
    })

    test('returns null for Vim/Neovim', () => {
      expect(extractProjectName('Vim', 'main.ts')).toBeNull()
      expect(extractProjectName('Neovim', 'file.py')).toBeNull()
    })

    test('returns null for Emacs', () => {
      expect(extractProjectName('Emacs', 'init.el')).toBeNull()
    })

    test('returns null for non-IDE apps', () => {
      expect(extractProjectName('Safari', 'Google')).toBeNull()
      expect(extractProjectName('Slack', '#general')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('returns null for empty window title', () => {
      expect(extractProjectName('Code', '')).toBeNull()
    })

    test('returns null for null-ish window title', () => {
      expect(extractProjectName('Code', '')).toBeNull()
    })

    test('trims whitespace from project name', () => {
      expect(extractProjectName('Code', 'file.ts -  my-project  - Code')).toBe('my-project')
    })
  })
})
