const fetchRepoIssues = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string) => {
    const { data } = await githubFetchWithToken<Array<GitHubIssue & { pull_request?: unknown }>>(
      token,
      `/repos/${owner}/${repo}/issues`,
      { params: { state: 'open', sort: 'updated', direction: 'desc', per_page: 5 } },
    )
    return data
      .filter(i => !('pull_request' in i))
      .map(toRepoIssue)
  },
  { maxAge: 300, name: 'repo-detail-issues', getKey: (login: string, _token: string, owner: string, repo: string) => `${login}/${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoIssues(login, token, owner, repo)
})
