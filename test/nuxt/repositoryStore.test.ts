import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { Repository } from '../../shared/types/repository'

const mockRepo: Repository = {
  id: 1,
  name: 'flumen',
  fullName: 'user/flumen',
  description: 'Dashboard',
  htmlUrl: 'https://github.com/user/flumen',
  language: 'TypeScript',
  visibility: 'public',
  defaultBranch: 'main',
  topics: ['nuxt'],
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
}

const orgRepo: Repository = {
  ...mockRepo,
  id: 2,
  name: 'org-project',
  fullName: 'myorg/org-project',
  owner: { login: 'myorg', avatarUrl: 'https://a.com/org.png' },
}

registerEndpoint('/api/repository', {
  method: 'GET',
  handler: (event: { path: string }) => {
    const url = new URL(event.path, 'http://localhost')
    const org = url.searchParams.get('org')
    return org === 'myorg' ? [orgRepo] : [mockRepo]
  },
})

registerEndpoint('/api/repository/counts', {
  method: 'GET',
  handler: () => ({ prCounts: {}, issueCounts: {} }),
})

registerEndpoint('/api/repository/notifications', {
  method: 'GET',
  handler: () => ({}),
})

registerEndpoint('/api/repository/activity', {
  method: 'GET',
  handler: () => ({}),
})

async function withStore<T>(fn: (store: ReturnType<typeof useRepositoryStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useRepositoryStore()
      store.repos = []
      store.selectedOrg = null
      store.loaded = false
      store.loading = false
      store.errorKey = null
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('repositoryStore', () => {
  it('fetchAll loads user repos by default', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      expect(store.loaded).toBe(true)
      expect(store.repos).toHaveLength(1)
      expect(store.repos[0]!.fullName).toBe('user/flumen')
      expect(store.selectedOrg).toBeNull()
    })
  })

  it('selectOrg switches to org repos and reloads', async () => {
    await withStore(async (store) => {
      await store.fetchAll()
      expect(store.repos[0]!.fullName).toBe('user/flumen')

      await store.selectOrg('myorg')
      expect(store.selectedOrg).toBe('myorg')
      expect(store.repos).toHaveLength(1)
      expect(store.repos[0]!.fullName).toBe('myorg/org-project')
    })
  })

  it('selectOrg(null) switches back to user repos', async () => {
    await withStore(async (store) => {
      await store.selectOrg('myorg')
      expect(store.repos[0]!.fullName).toBe('myorg/org-project')

      await store.selectOrg(null)
      expect(store.selectedOrg).toBeNull()
      expect(store.repos[0]!.fullName).toBe('user/flumen')
    })
  })
})
