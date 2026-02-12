import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { Issue } from '../../shared/types/issue'

const mockIssue: Issue = {
  id: 'I_1',
  number: 42,
  title: 'Test issue',
  state: 'OPEN',
  stateReason: null,
  url: 'https://github.com/org/repo/issues/42',
  createdAt: '2025-06-01T00:00:00Z',
  updatedAt: '2025-06-02T00:00:00Z',
  closedAt: null,
  author: { login: 'alice', avatarUrl: 'https://a.com/alice.png' },
  labels: [{ name: 'bug', color: 'ff0000' }],
  assignees: [{ login: 'bob', avatarUrl: 'https://a.com/bob.png' }],
  milestone: 'v1.0',
  commentCount: 3,
  linkedPrCount: 1,
  repository: { nameWithOwner: 'org/repo', name: 'repo', owner: 'org' },
}

registerEndpoint('/api/issues', {
  method: 'GET',
  handler: (event) => {
    const url = new URL(event.path, 'http://localhost')
    const repo = url.searchParams.get('repo')
    if (!repo) return { statusCode: 400 }
    return [mockIssue]
  },
})

async function withStore<T>(fn: (store: ReturnType<typeof useIssueStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useIssueStore()
      store.issues = []
      store.selectedRepo = null
      store.loaded = false
      store.loading = false
      store.errorKey = null
      store.stateFilter = 'open'
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('issueStore', () => {
  it('selectRepo fetches issues and sets loaded flag', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      expect(store.selectedRepo).toBe('org/repo')
      expect(store.loaded).toBe(true)
      expect(store.issues).toHaveLength(1)
      expect(store.issues[0].title).toBe('Test issue')
    })
  })

  it('selectRepo skips fetch when same repo already loaded', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      store.issues = [{ ...mockIssue, title: 'Modified locally' }]
      await store.selectRepo('org/repo')
      expect(store.issues[0].title).toBe('Modified locally')
    })
  })

  it('selectRepo re-fetches when switching to different repo', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      store.issues = [{ ...mockIssue, title: 'Modified locally' }]
      await store.selectRepo('org/other')
      expect(store.selectedRepo).toBe('org/other')
      expect(store.issues[0].title).toBe('Test issue')
    })
  })

  it('refresh re-fetches even for same repo', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      store.issues = [{ ...mockIssue, title: 'Stale' }]
      await store.refresh()
      expect(store.issues[0].title).toBe('Test issue')
    })
  })

  it('fetchIssues does nothing without selected repo', async () => {
    await withStore(async (store) => {
      await store.fetchIssues()
      expect(store.issues).toHaveLength(0)
      expect(store.loaded).toBe(false)
    })
  })
})
