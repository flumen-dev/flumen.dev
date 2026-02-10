const fetchIssueCounts = defineCachedFunction(
  async (login: string, token: string) => {
    return githubSearchCounts(token, `user:${login} type:issue state:open`)
  },
  { maxAge: 300, name: 'repo-issues', getKey: (login: string) => login },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchIssueCounts(login, token)
})
