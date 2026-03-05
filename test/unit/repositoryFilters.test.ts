import { describe, expect, it } from 'vitest'
import type { Repository } from '../../shared/types/repository'
import {
  collectAvailableLanguages,
  filterReposByActivity,
  filterReposByLanguage,
  filterReposBySearch,
  filterReposByType,
  pickForRepos,
  sortRepos,
} from '../../server/utils/repository-filters'

function makeRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 1,
    name: 'test-repo',
    fullName: 'user/test-repo',
    description: 'A test repository',
    htmlUrl: 'https://github.com/user/test-repo',
    language: 'TypeScript',
    visibility: 'public',
    defaultBranch: 'main',
    topics: ['nuxt', 'vue'],
    owner: { login: 'user', avatarUrl: 'https://a.com/user.png' },
    stargazersCount: 10,
    forksCount: 2,
    openIssuesCount: 3,
    watchersCount: 5,
    fork: false,
    archived: false,
    isTemplate: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    pushedAt: '2025-06-15T00:00:00Z',
    ...overrides,
  }
}

describe('filterReposBySearch', () => {
  const repos = [
    makeRepo({ name: 'flumen', fullName: 'user/flumen', description: 'Dashboard app' }),
    makeRepo({ name: 'nuxt-ui', fullName: 'user/nuxt-ui', description: 'Component library', topics: ['ui', 'components'] }),
    makeRepo({ name: 'hidden', fullName: 'user/hidden', description: null, topics: [] }),
  ]

  it('returns all repos when query is empty', () => {
    expect(filterReposBySearch(repos, '')).toHaveLength(3)
  })

  it('filters by name', () => {
    const result = filterReposBySearch(repos, 'flumen')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('flumen')
  })

  it('filters by description', () => {
    const result = filterReposBySearch(repos, 'dashboard')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('flumen')
  })

  it('does not match topics (too broad)', () => {
    const result = filterReposBySearch(repos, 'components')
    expect(result).toHaveLength(0)
  })

  it('matches lowercase query against mixed-case data', () => {
    const mixed = [makeRepo({ name: 'MyRepo', description: 'A Cool Project' })]
    expect(filterReposBySearch(mixed, 'myrepo')).toHaveLength(1)
    expect(filterReposBySearch(mixed, 'cool')).toHaveLength(1)
  })
})

describe('filterReposByType', () => {
  const repos = [
    makeRepo({ name: 'public-repo', visibility: 'public', fork: false, archived: false }),
    makeRepo({ name: 'private-repo', visibility: 'private', fork: false, archived: false }),
    makeRepo({ name: 'fork-repo', visibility: 'public', fork: true, archived: false }),
    makeRepo({ name: 'archived-repo', visibility: 'public', fork: false, archived: true }),
    makeRepo({ name: 'template-repo', visibility: 'public', fork: false, archived: false, isTemplate: true }),
  ]

  it('hides archived by default when no type filters', () => {
    const result = filterReposByType(repos, [])
    expect(result).toHaveLength(4)
    expect(result.find(r => r.name === 'archived-repo')).toBeUndefined()
  })

  it('filters by public', () => {
    const result = filterReposByType(repos, ['public'])
    expect(result.every(r => r.visibility === 'public')).toBe(true)
  })

  it('filters by private', () => {
    const result = filterReposByType(repos, ['private'])
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('private-repo')
  })

  it('filters by forks', () => {
    const result = filterReposByType(repos, ['forks'])
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('fork-repo')
  })

  it('shows archived when explicitly filtered', () => {
    const result = filterReposByType(repos, ['archived'])
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('archived-repo')
  })

  it('combines type filters with OR', () => {
    const result = filterReposByType(repos, ['private', 'forks'])
    expect(result).toHaveLength(2)
  })
})

describe('filterReposByLanguage', () => {
  const repos = [
    makeRepo({ name: 'ts-repo', language: 'TypeScript' }),
    makeRepo({ name: 'js-repo', language: 'JavaScript' }),
    makeRepo({ name: 'no-lang', language: null }),
  ]

  it('returns all repos when no languages specified', () => {
    expect(filterReposByLanguage(repos, [])).toHaveLength(3)
  })

  it('filters by single language', () => {
    const result = filterReposByLanguage(repos, ['TypeScript'])
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('ts-repo')
  })

  it('filters by multiple languages (OR)', () => {
    const result = filterReposByLanguage(repos, ['TypeScript', 'JavaScript'])
    expect(result).toHaveLength(2)
  })

  it('excludes repos with null language', () => {
    const result = filterReposByLanguage(repos, ['TypeScript'])
    expect(result.find(r => r.name === 'no-lang')).toBeUndefined()
  })
})

describe('filterReposByActivity', () => {
  const repos = [
    makeRepo({ fullName: 'user/a' }),
    makeRepo({ fullName: 'user/b' }),
    makeRepo({ fullName: 'user/c' }),
  ]

  it('filters by hasIssues', () => {
    const result = filterReposByActivity(repos, ['hasIssues'], { 'user/a': 5 }, {}, {})
    expect(result).toHaveLength(1)
    expect(result[0]!.fullName).toBe('user/a')
  })

  it('filters by hasPrs', () => {
    const result = filterReposByActivity(repos, ['hasPrs'], {}, { 'user/b': 3 }, {})
    expect(result).toHaveLength(1)
    expect(result[0]!.fullName).toBe('user/b')
  })

  it('filters by hasNotifications', () => {
    const result = filterReposByActivity(repos, ['hasNotifications'], {}, {}, { 'user/c': 1 })
    expect(result).toHaveLength(1)
    expect(result[0]!.fullName).toBe('user/c')
  })

  it('combines activity filters with AND', () => {
    const result = filterReposByActivity(
      repos,
      ['hasIssues', 'hasPrs'],
      { 'user/a': 5 },
      { 'user/a': 2, 'user/b': 3 },
      {},
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.fullName).toBe('user/a')
  })

  it('returns all repos when no activity filters', () => {
    expect(filterReposByActivity(repos, [], {}, {}, {})).toHaveLength(3)
  })
})

describe('sortRepos', () => {
  const repos = [
    makeRepo({ fullName: 'user/beta', name: 'beta', stargazersCount: 5 }),
    makeRepo({ fullName: 'user/alpha', name: 'alpha', stargazersCount: 20 }),
    makeRepo({ fullName: 'user/gamma', name: 'gamma', stargazersCount: 10 }),
  ]

  it('sorts by stars descending', () => {
    const result = sortRepos(repos, 'stars', {}, {}, {})
    expect(result.map(r => r.name)).toEqual(['alpha', 'gamma', 'beta'])
  })

  it('sorts by name alphabetically', () => {
    const result = sortRepos(repos, 'name', {}, {}, {})
    expect(result.map(r => r.name)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('sorts by issues descending', () => {
    const issueCounts = { 'user/beta': 10, 'user/alpha': 2, 'user/gamma': 5 }
    const result = sortRepos(repos, 'issues', issueCounts, {}, {})
    expect(result.map(r => r.name)).toEqual(['beta', 'gamma', 'alpha'])
  })

  it('sorts by prs descending', () => {
    const prCounts = { 'user/gamma': 15, 'user/alpha': 1 }
    const result = sortRepos(repos, 'prs', {}, prCounts, {})
    expect(result.map(r => r.name)).toEqual(['gamma', 'alpha', 'beta'])
  })

  it('sorts by notifications descending', () => {
    const notifs = { 'user/beta': 8, 'user/gamma': 3 }
    const result = sortRepos(repos, 'notifications', {}, {}, notifs)
    expect(result.map(r => r.name)).toEqual(['beta', 'gamma', 'alpha'])
  })

  it('preserves order for pushed (default)', () => {
    const result = sortRepos(repos, 'pushed', {}, {}, {})
    expect(result.map(r => r.name)).toEqual(['beta', 'alpha', 'gamma'])
  })

  it('does not mutate original array', () => {
    const original = [...repos]
    sortRepos(repos, 'stars', {}, {}, {})
    expect(repos.map(r => r.name)).toEqual(original.map(r => r.name))
  })
})

describe('collectAvailableLanguages', () => {
  it('collects unique languages sorted alphabetically', () => {
    const repos = [
      makeRepo({ language: 'TypeScript' }),
      makeRepo({ language: 'JavaScript' }),
      makeRepo({ language: 'TypeScript' }),
      makeRepo({ language: null }),
    ]
    expect(collectAvailableLanguages(repos)).toEqual(['JavaScript', 'TypeScript'])
  })

  it('returns empty for repos with no languages', () => {
    expect(collectAvailableLanguages([makeRepo({ language: null })])).toEqual([])
  })
})

describe('pickForRepos', () => {
  const repos = [
    makeRepo({ fullName: 'user/a' }),
    makeRepo({ fullName: 'user/b' }),
  ]

  it('picks only entries matching repo fullNames', () => {
    const all = { 'user/a': 10, 'user/b': 5, 'user/c': 3 }
    const result = pickForRepos(all, repos)
    expect(result).toEqual({ 'user/a': 10, 'user/b': 5 })
  })

  it('skips repos with no matching entries', () => {
    const all = { 'user/a': 10 }
    const result = pickForRepos(all, repos)
    expect(result).toEqual({ 'user/a': 10 })
  })
})
