// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/a11y',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@nuxtjs/i18n',
  ],
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',

  eslint: {
    config: {
      stylistic: true,
    },
  },
  i18n: {
    strategy: 'prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
  },
})
