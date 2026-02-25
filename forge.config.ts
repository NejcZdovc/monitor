import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'

// Native modules that must be included in the packaged app (not bundled by Vite)
const nativeModules = ['/node_modules/better-sqlite3', '/node_modules/uiohook-napi']

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Monitor',
    icon: './assets/icon',
    asar: true,
    ignore: (file: string) => {
      if (!file) return false
      // Include Vite build output
      if (file.startsWith('/.vite')) return false
      // Include package.json and assets
      if (file === '/package.json') return false
      if (file.startsWith('/assets')) return false
      // Allow traversal into node_modules directory
      if (file === '/node_modules') return false
      // Include native modules and their transitive dependencies
      if (nativeModules.some((mod) => file.startsWith(mod))) return false
      // Include bindings lookup helpers used by native modules
      if (file.startsWith('/node_modules/bindings') || file.startsWith('/node_modules/file-uri-to-path')) return false
      if (file.startsWith('/node_modules/node-gyp-build')) return false
      // electron-updater and its dependencies
      if (file.startsWith('/node_modules/electron-updater')) return false
      if (file.startsWith('/node_modules/builder-util-runtime')) return false
      if (file.startsWith('/node_modules/lazy-val')) return false
      if (file.startsWith('/node_modules/tiny-typed-emitter')) return false
      if (file.startsWith('/node_modules/semver')) return false
      if (file.startsWith('/node_modules/fs-extra')) return false
      if (file.startsWith('/node_modules/graceful-fs')) return false
      if (file.startsWith('/node_modules/jsonfile')) return false
      if (file.startsWith('/node_modules/universalify')) return false
      if (file.startsWith('/node_modules/js-yaml')) return false
      if (file.startsWith('/node_modules/argparse')) return false
      if (file.startsWith('/node_modules/lodash.escaperegexp')) return false
      if (file.startsWith('/node_modules/lodash.isequal')) return false
      if (file.startsWith('/node_modules/sax')) return false
      if (file.startsWith('/node_modules/debug')) return false
      if (file.startsWith('/node_modules/ms')) return false
      // Ignore everything else
      return true
    },
    extendInfo: {
      LSUIElement: true,
    },
    osxSign: process.env.APPLE_ID ? {} : undefined,
    osxNotarize: process.env.APPLE_ID
      ? {
          appleId: process.env.APPLE_ID!,
          appleIdPassword: process.env.APPLE_PASSWORD!,
          teamId: process.env.APPLE_TEAM_ID!,
        }
      : undefined,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/renderer/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/renderer/tray-preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/main/tracking/input-worker.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
        {
          name: 'tray_popup',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'NejcZdovc',
          name: 'monitor',
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
}

export default config
