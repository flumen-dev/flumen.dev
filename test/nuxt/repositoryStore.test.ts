import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { Repository, RepoPageResponse } from '../../shared/types/repository'

function makeRepo(id: number, name: string, owner: string = 'user'): Repository {
  return {
    id,
    name,
    fullName: `${owner}/${name}`,
    description: `${name} description`,
    htmlUrl: `https://github.com/${owner}/${name}`,
    language: 'TypeScript',
    visibility: 'public',
    defaultBranch: 'main',
    topics: [],
    owner: { login: owner, avatarUrl: `https://a.com/${owner}.png` },
    stargazersCount: 0,
    forksCount: 0,
    openIssuesCount: 0,
    watchersCount: 0,
    fork: false,
    archived: false,
    isTemplate: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    pushedAt: '2025-06-15T00:00:00Z',
  }
}

// Generate 25 repos for pagination tests
const userRepos = Array.from({ length: 25 }, (_, i) => makeRepo(i + 1, `repo-${i + 1}`))
const orgRepos = [makeRepo(100, 'org-project', 'myorg')]

function makePageResponse(allRepos: Repository[], params: URLSearchParams): RepoPageResponse {
  const first = Number(params.get('first')) || 20
  const after = params.get('after')
  const page = after ? Math.max(1, Number(after)) : 1
  const start = (page - 1) * first
  const pageRepos = allRepos.slice(start, start + first)
  const hasNextPage = start + first < allRepos.length

  return {
    items: pageRepos,
    totalCount: allRepos.length,
    pageInfo: {
      hasNextPage,
      endCursor: hasNextPage ? String(page + 1) : null,
    },
    availableLanguages: ['TypeScript'],
    prCounts: Object.fromEntries(pageRepos.map(r => [r.fullName, r.id])),
    issueCounts: Object.fromEntries(pageRepos.map(r => [r.fullName, r.id * 2])),
    notificationCounts: {},
    activity: {},
  }
}

registerEndpoint('/api/repository', {
  method: 'GET',
  handler: (event: { path: string }) => {
    const url = new URL(event.path, 'http://localhost')
    const org = url.searchParams.get('org')
    const repos = org === 'myorg' ? orgRepos : userRepos
    return makePageResponse(repos, url.searchParams)
  },
})

async function withStore<T>(fn: (store: ReturnType<typeof useRepositoryStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useRepositoryStore()
      store.repos = []
      store.selectedOrg = null
      store.errorKey = null
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('repositoryStore', () => {
  it('fetchRepos loads first page of user repos', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      expect(store.repos).toHaveLength(20)
      expect(store.repos[0]!.fullName).toBe('user/repo-1')
      expect(store.selectedOrg).toBeNull()
      expect(store.totalCount).toBe(25)
    })
  })

  it('has pagination state after initial fetch', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      expect(store.hasMore).toBe(true)
      expect(store.hasPrevious).toBe(false)
      expect(store.currentPage).toBe(1)
      expect(store.totalPages).toBe(2)
    })
  })

  it('nextPage loads page 2', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      expect(store.repos).toHaveLength(20)

      await store.nextPage()
      expect(store.repos).toHaveLength(5)
      expect(store.repos[0]!.fullName).toBe('user/repo-21')
      expect(store.currentPage).toBe(2)
      expect(store.hasMore).toBe(false)
      expect(store.hasPrevious).toBe(true)
    })
  })

  it('prevPage returns to page 1', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      await store.nextPage()
      expect(store.currentPage).toBe(2)

      await store.prevPage()
      expect(store.currentPage).toBe(1)
      expect(store.repos).toHaveLength(20)
      expect(store.repos[0]!.fullName).toBe('user/repo-1')
      expect(store.hasPrevious).toBe(false)
      expect(store.hasMore).toBe(true)
    })
  })

  it('enrichment data is populated from response', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      // prCounts are set to repo.id by the mock
      expect(store.prCounts['user/repo-1']).toBe(1)
      expect(store.issueCounts['user/repo-1']).toBe(2)
      expect(store.availableLanguages).toEqual(['TypeScript'])
    })
  })

  it('enrichment data updates on page change', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      expect(store.prCounts['user/repo-1']).toBe(1)
      expect(store.prCounts['user/repo-21']).toBeUndefined()

      await store.nextPage()
      // Page 2 has repos 21-25, enrichment should update
      expect(store.prCounts['user/repo-21']).toBe(21)
      // Page 1 counts are no longer in enrichment
      expect(store.prCounts['user/repo-1']).toBeUndefined()
    })
  })

  it('enrichment data restored from page cache on prevPage', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      await store.nextPage()
      await store.prevPage()

      // Back on page 1 — enrichment from cached response
      expect(store.prCounts['user/repo-1']).toBe(1)
      expect(store.prCounts['user/repo-21']).toBeUndefined()
    })
  })

  it('selectOrg switches to org repos and resets pagination', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      expect(store.repos[0]!.fullName).toBe('user/repo-1')
      expect(store.totalCount).toBe(25)

      await store.selectOrg('myorg')
      expect(store.selectedOrg).toBe('myorg')
      expect(store.repos).toHaveLength(1)
      expect(store.repos[0]!.fullName).toBe('myorg/org-project')
      expect(store.totalCount).toBe(1)
      expect(store.currentPage).toBe(1)
      expect(store.hasMore).toBe(false)
    })
  })

  it('selectOrg(null) switches back to user repos', async () => {
    await withStore(async (store) => {
      await store.selectOrg('myorg')
      expect(store.repos[0]!.fullName).toBe('myorg/org-project')

      await store.selectOrg(null)
      expect(store.selectedOrg).toBeNull()
      expect(store.repos[0]!.fullName).toBe('user/repo-1')
      expect(store.totalCount).toBe(25)
    })
  })

  it('selectOrg with same org is a no-op', async () => {
    await withStore(async (store) => {
      await store.selectOrg('myorg')
      const firstRepos = store.repos
      await store.selectOrg('myorg')
      expect(store.repos).toBe(firstRepos)
    })
  })

  it('resetPagination clears state', async () => {
    await withStore(async (store) => {
      await store.fetchRepos()
      await store.nextPage()
      expect(store.currentPage).toBe(2)

      store.resetPagination()
      expect(store.currentPage).toBe(1)
      expect(store.hasMore).toBe(false)
      expect(store.hasPrevious).toBe(false)
    })
  })
})
