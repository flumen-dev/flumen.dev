export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { url } = await readBody<{ url: string }>(event)

  const response = await fetch('https://api.github.com/user/social_accounts', {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ account_urls: [url] }),
  })

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `GitHub API ${response.status}: ${response.statusText}` })
  }

  return { success: true }
})
