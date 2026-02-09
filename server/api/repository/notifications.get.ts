interface GitHubNotification {
  repository: { full_name: string }
}

const fetchNotificationCounts = defineCachedFunction(
  async (_login: string, token: string) => {
    const { data } = await githubFetchAllWithToken<GitHubNotification>(
      token,
      '/notifications',
    )

    const counts: Record<string, number> = {}
    for (const n of data) {
      const name = n.repository.full_name
      counts[name] = (counts[name] || 0) + 1
    }

    return counts
  },
  { maxAge: 120, name: 'repo-notifications', getKey: (login: string) => login },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchNotificationCounts(login, token)
})
