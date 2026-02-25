export default defineI18nConfig(() => ({
  datetimeFormats: {
    en: {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
      monthYear: { year: 'numeric', month: 'long' },
    },
    de: {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
      monthYear: { year: 'numeric', month: 'long' },
    },
  },
}))
