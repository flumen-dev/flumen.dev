import type { RepoPageResponse } from '~~/shared/types/repository'

export default defineEventHandler(async (event) => {
  const { token, userId, login } = await getSessionToken(event)
  const query = getQuery(event)
  const org = getOrgQuery(event)

  const first = Math.min(Math.max(1, Number(query.first) || 20), 100)
  const afterRaw = (query.after as string) || null
  const after = afterRaw && Number.isFinite(Number(afterRaw)) ? afterRaw : null
  const searchQ = ((query.search as string) || '').toLowerCase().trim()
  const sortBy = (query.sort as string) || 'pushed'
  const filtersRaw = (query.filters as string) || ''
  const languagesRaw = (query.languages as string) || ''

  const filterList = filtersRaw ? filtersRaw.split(',') : []
  const languageList = languagesRaw ? languagesRaw.split(',') : []
  const typeFilters = filterList.filter(f => !ACTIVITY_FILTER_KEYS.includes(f as typeof ACTIVITY_FILTER_KEYS[number]))

  // Fetch all repos (ETag-cached)
  const endpoint = org ? `/orgs/${org}/repos` : '/user/repos'
  const params: Record<string, string> = { sort: 'pushed', direction: 'desc' }
  if (!org) params.type = 'owner'

  const { data: rawRepos } = await githubCachedFetchAllWithToken<GitHubRepo>(token, userId, endpoint, { params })
  const allRepos = rawRepos.map(toRepository)

  // Languages from full set (before filtering)
  const availableLanguages = collectAvailableLanguages(allRepos)

  // Filter
  let repos = filterReposBySearch(allRepos, searchQ)
  repos = filterReposByType(repos, typeFilters)
  repos = filterReposByLanguage(repos, languageList)

  // Enrichment (cached)
  const [allActivity, allNotifications] = await Promise.all([
    fetchRepoActivity(login, token),
    fetchRepoNotifications(login, token),
  ])

  // Counts — only fetch when needed for activity filters or count-based sorts
  const needsAllCounts = filterList.some(f => ACTIVITY_FILTER_KEYS.includes(f as typeof ACTIVITY_FILTER_KEYS[number]))
    || sortBy === 'issues' || sortBy === 'prs' || sortBy === 'notifications'

  let allPrCounts: Record<string, number> = {}
  let allIssueCounts: Record<string, number> = {}

  if (needsAllCounts && repos.length) {
    const repoList = repos.map(r => ({ owner: r.owner.login, name: r.name }))
    const repoHash = repoList.map(r => `${r.owner}/${r.name}`).sort().join(',')
    const cacheKey = `${login}:${org ?? '_user'}:${repoHash}`
    const counts = await fetchRepoCounts(cacheKey, token, repoList)
    allPrCounts = counts.prCounts
    allIssueCounts = counts.issueCounts
  }

  // Activity-based filters
  repos = filterReposByActivity(repos, filterList, allIssueCounts, allPrCounts, allNotifications)

  // Sort
  repos = sortRepos(repos, sortBy, allIssueCounts, allPrCounts, allNotifications)

  // Paginate
  const totalCount = repos.length
  const page = after ? Math.max(1, Number(after)) : 1
  const startIndex = (page - 1) * first
  const pageRepos = repos.slice(startIndex, startIndex + first)
  const hasNextPage = startIndex + first < totalCount
  const endCursor = hasNextPage ? String(page + 1) : null

  // Page-level counts (only if not already fetched for all)
  let pagePrCounts = allPrCounts
  let pageIssueCounts = allIssueCounts

  if (!needsAllCounts && pageRepos.length) {
    const repoList = pageRepos.map(r => ({ owner: r.owner.login, name: r.name }))
    const repoHash = repoList.map(r => `${r.owner}/${r.name}`).sort().join(',')
    const cacheKey = `${login}:${org ?? '_user'}:${repoHash}`
    const counts = await fetchRepoCounts(cacheKey, token, repoList)
    pagePrCounts = counts.prCounts
    pageIssueCounts = counts.issueCounts
  }

  return {
    items: pageRepos,
    totalCount,
    pageInfo: { hasNextPage, endCursor },
    availableLanguages,
    prCounts: pickForRepos(pagePrCounts, pageRepos),
    issueCounts: pickForRepos(pageIssueCounts, pageRepos),
    notificationCounts: pickForRepos(allNotifications, pageRepos),
    activity: pickForRepos(allActivity, pageRepos),
  } satisfies RepoPageResponse
})
