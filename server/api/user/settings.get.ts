export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const storage = useStorage('data')
  const settings = await storage.getItem<Record<string, unknown>>(`users:${session.user!.id}:settings`)

  return { ...defaultUserSettings, ...settings }
})
