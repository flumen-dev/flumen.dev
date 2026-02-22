export default defineEventHandler(async (event) => {
  const { userId } = await getSessionToken(event)
  const storage = useStorage('data')
  await storage.setItem(`users:${userId}:inbox-last-opened`, new Date().toISOString())
  return { ok: true }
})
