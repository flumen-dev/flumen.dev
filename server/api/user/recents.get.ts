export default defineEventHandler(async (event): Promise<RecentItem[]> => {
  const session = await getUserSession(event)
  const storage = useStorage('data')
  const recents = await storage.getItem<RecentItem[]>(`users:${session.user!.id}:recents`)
  return recents ?? []
})
