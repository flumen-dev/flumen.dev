interface GitHubSearchResult {
  items: Array<{
    id: number
    full_name: string
    name: string
    owner: { login: string }
    description: string | null
    language: string | null
    visibility: string
    open_issues_count: number
    stargazers_count: number
  }>
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const { q } = getQuery<{ q?: string }>(event)

  if (!q || q.length < 2) {
    return []
  }

  const { data } = await githubFetchWithToken<GitHubSearchResult>(
    token,
    '/search/repositories',
    { params: { q, per_page: 10, sort: 'stars', order: 'desc' } },
  )

  return data.items.map(r => ({
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    description: r.description,
    language: r.language,
    visibility: r.visibility,
    openIssues: r.open_issues_count,
    stars: r.stargazers_count,
  }))
})
