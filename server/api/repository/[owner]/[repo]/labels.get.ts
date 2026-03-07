const fetchRepoLabels = defineCachedFunction(
  async (token: string, owner: string, repo: string) => {
    const res = await githubFetchAllWithToken<{ name: string, color: string, description: string | null }>(
      token,
      `/repos/${owner}/${repo}/labels`,
    )
    return res.data.map(l => ({ name: l.name, color: l.color, description: l.description }))
  },
  {
    maxAge: 15 * 60, // 15 minutes
    name: 'repo-labels',
    getKey: (_token: string, owner: string, repo: string) => `${owner}/${repo}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)

  return await fetchRepoLabels(token, owner, repo)
})
