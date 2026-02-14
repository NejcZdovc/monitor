module.exports = {
  packagerConfig: {
    name: 'Monitor',
    icon: './assets/icon',
    asar: true,
    extendInfo: {
      LSUIElement: true
    },
    osxSign: process.env.APPLE_ID ? {} : undefined,
    osxNotarize: process.env.APPLE_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    } : undefined
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO'
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'NejcZdovc',
          name: 'monitor'
        },
        prerelease: false,
        draft: false
      }
    }
  ]
};
