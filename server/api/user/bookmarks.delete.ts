export default defineEventHandler(async (event): Promise<Bookmark[]> => {
  const session = await requireUserSession(event)
  const id = getQuery<{ id?: string }>(event).id
  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing id' })
  }

  const storage = useStorage('data')
  const key = `users:${session.user.id}:bookmarks`
  const current = (await storage.getItem<Bookmark[]>(key)) ?? []
  const next = current.filter(b => b.id !== id)
  await storage.setItem(key, next)
  return next
})
