// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/a11y',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    'nuxt-echarts',
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

  vite: {
    optimizeDeps: {
      include: [
        '@nuxt/ui > prosemirror-state',
        '@nuxt/ui > prosemirror-transform',
        '@nuxt/ui > prosemirror-model',
        '@nuxt/ui > prosemirror-view',
        '@nuxt/ui > prosemirror-gapcursor',
      ],
    },
  },
  echarts: {
    renderer: 'svg',
    charts: ['LineChart', 'BarChart'],
    components: ['GridComponent', 'TooltipComponent'],
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
