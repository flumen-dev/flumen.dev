const fetchRepoIssues = defineCachedFunction(
  async (token: string, owner: string, repo: string) => {
    const { data } = await githubFetchWithToken<GitHubIssue[]>(
      token,
      `/repos/${owner}/${repo}/issues`,
      { params: { state: 'open', sort: 'updated', direction: 'desc', per_page: 5 } },
    )
    return data.map(toRepoIssue)
  },
  { maxAge: 300, name: 'repo-detail-issues', getKey: (_token: string, owner: string, repo: string) => `${owner}/${repo}` },
)

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  return fetchRepoIssues(token, owner, repo)
})
