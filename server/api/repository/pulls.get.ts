const fetchPullCounts = defineCachedFunction(
  async (login: string, token: string) => {
    return githubSearchCounts(token, `user:${login} type:pr state:open`)
  },
  { maxAge: 300, name: 'repo-pulls', getKey: (login: string) => login },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  return fetchPullCounts(login, token)
})
