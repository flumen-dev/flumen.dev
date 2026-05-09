export default defineEventHandler(async (event): Promise<Bookmark[]> => {
  const session = await requireUserSession(event)
  const storage = useStorage('data')
  const bookmarks = await storage.getItem<Bookmark[]>(`users:${session.user.id}:bookmarks`)
  return bookmarks ?? []
})
