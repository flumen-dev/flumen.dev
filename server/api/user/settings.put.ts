export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const body = await readBody<Partial<UserSettings>>(event)
  const storage = useStorage('data')
  const current = await storage.getItem<UserSettings>(`users:${session.user!.id}:settings`) || defaultUserSettings

  const updated: UserSettings = { ...current, ...body }
  await storage.setItem(`users:${session.user!.id}:settings`, updated)

  return updated
})
