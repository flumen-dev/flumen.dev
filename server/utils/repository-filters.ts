import type { Repository } from '~~/shared/types/repository'

export const ACTIVITY_FILTER_KEYS = ['hasIssues', 'hasPrs', 'hasNotifications'] as const

export function filterReposBySearch(repos: Repository[], query: string): Repository[] {
  const q = query.trim().toLowerCase()
  if (!q) return repos
  return repos.filter(r =>
    r.name.toLowerCase().includes(q)
    || r.description?.toLowerCase().includes(q),
  )
}

export function filterReposByType(repos: Repository[], typeFilters: string[]): Repository[] {
  if (!typeFilters.length) {
    return repos.filter(r => !r.archived)
  }
  return repos.filter((r) => {
    if (typeFilters.includes('public') && r.visibility === 'public') return true
    if (typeFilters.includes('private') && r.visibility === 'private') return true
    if (typeFilters.includes('forks') && r.fork) return true
    if (typeFilters.includes('templates') && r.isTemplate) return true
    if (typeFilters.includes('archived') && r.archived) return true
    return false
  })
}

export function filterReposByLanguage(repos: Repository[], languages: string[]): Repository[] {
  if (!languages.length) return repos
  return repos.filter(r => r.language && languages.includes(r.language))
}

export function filterReposByActivity(
  repos: Repository[],
  filters: string[],
  issueCounts: Record<string, number>,
  prCounts: Record<string, number>,
  notificationCounts: Record<string, number>,
): Repository[] {
  let result = repos
  if (filters.includes('hasIssues')) {
    result = result.filter(r => issueCounts[r.fullName])
  }
  if (filters.includes('hasPrs')) {
    result = result.filter(r => prCounts[r.fullName])
  }
  if (filters.includes('hasNotifications')) {
    result = result.filter(r => notificationCounts[r.fullName])
  }
  return result
}

export function sortRepos(
  repos: Repository[],
  sortBy: string,
  issueCounts: Record<string, number>,
  prCounts: Record<string, number>,
  notificationCounts: Record<string, number>,
): Repository[] {
  const sorted = [...repos]
  switch (sortBy) {
    case 'stars':
      sorted.sort((a, b) => b.stargazersCount - a.stargazersCount)
      break
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'issues':
      sorted.sort((a, b) => (issueCounts[b.fullName] ?? 0) - (issueCounts[a.fullName] ?? 0))
      break
    case 'prs':
      sorted.sort((a, b) => (prCounts[b.fullName] ?? 0) - (prCounts[a.fullName] ?? 0))
      break
    case 'notifications':
      sorted.sort((a, b) => (notificationCounts[b.fullName] ?? 0) - (notificationCounts[a.fullName] ?? 0))
      break
    // 'pushed' — already sorted by GitHub API
  }
  return sorted
}

export function collectAvailableLanguages(repos: Repository[]): string[] {
  const set = new Set(repos.map(r => r.language).filter(Boolean) as string[])
  return [...set].sort()
}

/** Pick enrichment entries for a subset of repos */
export function pickForRepos<T>(all: Record<string, T>, repos: Repository[]): Record<string, T> {
  const result: Record<string, T> = {}
  for (const repo of repos) {
    if (repo.fullName in all) {
      result[repo.fullName] = all[repo.fullName]!
    }
  }
  return result
}
