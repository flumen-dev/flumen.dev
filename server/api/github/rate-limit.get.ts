export default defineEventHandler(async (event) => {
  await getSessionToken(event)
  return getRateLimit()
})
