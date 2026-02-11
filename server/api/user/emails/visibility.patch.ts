export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { visibility } = await readBody<{ visibility: 'public' | 'private' }>(event)

  const { data } = await githubFetchWithToken<{ email: string, visibility: string }[]>(
    token,
    '/user/email/visibility',
    { method: 'PATCH', body: { visibility } },
  )

  return data
})
