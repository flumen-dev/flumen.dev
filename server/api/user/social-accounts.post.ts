export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { url } = await readBody<{ url: string }>(event)

  const { data } = await githubFetchWithToken<{ provider: string, url: string }[]>(
    token,
    '/user/social_accounts',
    { method: 'POST', body: { account_urls: [url] } },
  )

  return data
})
