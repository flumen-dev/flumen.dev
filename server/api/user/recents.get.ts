export default defineEventHandler(async (event): Promise<CmdkRecentItem[]> => {
  const session = await getUserSession(event)
  const storage = useStorage('data')
  const recents = await storage.getItem<CmdkRecentItem[]>(`users:${session.user!.id}:recents`)
  return recents ?? []
})
