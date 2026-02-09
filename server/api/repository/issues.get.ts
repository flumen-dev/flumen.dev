const fetchIssueCounts = defineCachedFunction(
  async (login: string, token: string) => {
    const counts: Record<string, number> = {}
    let page = 1

    while (true) {
      const { data } = await githubFetchWithToken<SearchResponse>(
        token,
        '/search/issues',
        { params: { q: `user:${login} type:issue state:open`, per_page: 100, page } },
      )

      for (const item of data.items) {
        const fullName = item.repository_url.replace('https://api.github.com/repos/', '')
        counts[fullName] = (counts[fullName] || 0) + 1
      }

      if (data.items.length < 100) break
      page++
      if (page > 10) break
    }

    return counts
  },
  { maxAge: 300, name: 'repo-issues', getKey: (login: string) => login },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchIssueCounts(login, token)
})
