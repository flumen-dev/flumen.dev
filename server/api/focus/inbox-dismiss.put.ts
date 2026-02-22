const MAX_DISMISSED = 5000
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export default defineEventHandler(async (event) => {
  const { userId } = await getSessionToken(event)
  const body = await readBody<{ itemKey: string }>(event)

  if (!body.itemKey) {
    throw createError({ statusCode: 400, message: 'itemKey required' })
  }

  const storage = useStorage('data')
  const storageKey = `users:${userId}:inbox-dismissed`
  const dismissed = await storage.getItem<Record<string, string>>(storageKey) || {}

  dismissed[body.itemKey] = new Date().toISOString()

  // Cleanup: remove entries older than 90 days, then cap at 5000
  const now = Date.now()
  const entries = Object.entries(dismissed)
    .filter(([, ts]) => now - new Date(ts).getTime() < MAX_AGE_MS)
    .sort((a, b) => b[1].localeCompare(a[1])) // newest first

  const trimmed = Object.fromEntries(entries.slice(0, MAX_DISMISSED))
  await storage.setItem(storageKey, trimmed)

  return { ok: true }
})
