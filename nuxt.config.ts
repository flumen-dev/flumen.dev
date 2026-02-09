// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/a11y',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    'nuxt-auth-utils',
  ],
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    oauth: {
      github: {
        clientId: process.env.NUXT_OAUTH_GITHUB_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET,
      },
    },
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || 'supersecretpassword',
    },
  },
  compatibilityDate: '2025-07-15',

  nitro: {
    storage: {
      data: {
        driver: process.env.STORAGE_DRIVER || 'fs',
        base: process.env.STORAGE_DRIVER ? undefined : '.data/storage',
        url: process.env.STORAGE_URL,
        token: process.env.STORAGE_TOKEN,
      },
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },
  i18n: {
    strategy: 'prefix',
    defaultLocale: 'en',
    detectBrowserLanguage: {
      useCookie: false,
      redirectOn: 'root',
    },
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
  },
})
