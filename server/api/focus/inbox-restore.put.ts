export default defineEventHandler(async (event) => {
  const { userId } = await getSessionToken(event)
  const body = await readBody<{ itemKey: string }>(event)

  if (!body.itemKey) {
    throw createError({ statusCode: 400, message: 'itemKey required' })
  }

  const storage = useStorage('data')
  const storageKey = `users:${userId}:inbox-dismissed`
  const dismissed = await storage.getItem<Record<string, string>>(storageKey) || {}

  const { [body.itemKey]: _, ...rest } = dismissed
  await storage.setItem(storageKey, rest)

  return { ok: true }
})
