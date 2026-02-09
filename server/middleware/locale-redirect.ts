const LOCALES = ['en', 'de']

// Middleware to redirect users to their preferred locale based on settings
// Best SEO-friendly way
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/api/') || path.startsWith('/_nuxt/') || path.startsWith('/auth/')) return

  const session = await getUserSession(event)
  if (!session?.user?.id) return

  const storage = useStorage('data')
  const settings = await storage.getItem<{ locale?: string }>(`users:${session.user.id}:settings`)
  if (!settings?.locale) return

  const savedLocale = settings.locale
  const pathLocale = path.split('/')[1]

  if (LOCALES.includes(pathLocale ?? 'en') && pathLocale !== savedLocale) {
    const newPath = path.replace(`/${pathLocale}`, `/${savedLocale}`)
    return sendRedirect(event, newPath, 301)
  }

  if (path === '/') {
    return sendRedirect(event, `/${savedLocale}/`, 301)
  }
})
