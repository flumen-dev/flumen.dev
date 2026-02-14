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
  maintainerCommented: false,
  repository: { nameWithOwner: 'org/repo', name: 'repo', owner: 'org' },
}

registerEndpoint('/api/issues', {
  method: 'GET',
  handler: (event) => {
    const url = new URL(event.path, 'http://localhost')
    const repo = url.searchParams.get('repo')
    if (!repo) return { statusCode: 400 }
    return {
      issues: [mockIssue],
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: null },
    }
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
      store.search = ''
      store.searchResults = []
      store.sortKey = 'critical'
      store.activeFilters = []
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
      expect(store.issues[0]?.title).toBe('Test issue')
    })
  })

  it('selectRepo skips fetch when same repo already loaded', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      store.issues = [{ ...mockIssue, title: 'Modified locally' }]
      await store.selectRepo('org/repo')
      expect(store.issues[0]?.title).toBe('Modified locally')
    })
  })

  it('selectRepo re-fetches when switching to different repo', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      store.issues = [{ ...mockIssue, title: 'Modified locally' }]
      await store.selectRepo('org/other')
      expect(store.selectedRepo).toBe('org/other')
      expect(store.issues[0]?.title).toBe('Test issue')
    })
  })

  it('refresh re-fetches even for same repo', async () => {
    await withStore(async (store) => {
      await store.selectRepo('org/repo')
      store.issues = [{ ...mockIssue, title: 'Stale' }]
      await store.refresh()
      expect(store.issues[0]?.title).toBe('Test issue')
    })
  })

  it('fetchIssues does nothing without selected repo', async () => {
    await withStore(async (store) => {
      await store.fetchIssues()
      expect(store.issues).toHaveLength(0)
      expect(store.loaded).toBe(false)
    })
  })

  it('search uses server-side searchResults', async () => {
    await withStore((store) => {
      store.issues = [
        { ...mockIssue, id: 'I_1', title: 'Login bug' },
        { ...mockIssue, id: 'I_2', title: 'Dashboard crash' },
      ]
      store.search = 'login'
      // Server-side search: filteredIssues returns searchResults when search is active
      store.searchResults = [{ ...mockIssue, id: 'I_1', title: 'Login bug' }]
      expect(store.filteredIssues).toHaveLength(1)
      expect(store.filteredIssues[0]?.title).toBe('Login bug')
    })
  })

  it('search returns empty when no server results', async () => {
    await withStore((store) => {
      store.issues = [
        { ...mockIssue, id: 'I_1', number: 42 },
        { ...mockIssue, id: 'I_2', number: 99 },
      ]
      store.search = '#99'
      // No searchResults set — filteredIssues returns empty
      expect(store.filteredIssues).toHaveLength(0)
    })
  })

  it('unassigned filter keeps only issues without assignees', async () => {
    await withStore((store) => {
      store.issues = [
        { ...mockIssue, id: 'I_1', assignees: [] },
        { ...mockIssue, id: 'I_2', assignees: [{ login: 'bob', avatarUrl: '' }] },
      ]
      store.activeFilters = ['unassigned']
      expect(store.filteredIssues).toHaveLength(1)
      expect(store.filteredIssues[0]?.id).toBe('I_1')
    })
  })

  it('critical sort ranks unassigned high-comment issues first', async () => {
    await withStore((store) => {
      const assigned: Issue = { ...mockIssue, id: 'I_low', commentCount: 1, assignees: [{ login: 'x', avatarUrl: '' }], linkedPrCount: 1, maintainerCommented: true }
      const hot: Issue = { ...mockIssue, id: 'I_hot', commentCount: 10, assignees: [], linkedPrCount: 0, maintainerCommented: false }
      store.issues = [assigned, hot]
      store.sortKey = 'critical'
      expect(store.filteredIssues[0]?.id).toBe('I_hot')
    })
  })

  it('critical sort boosts issues where maintainer has not commented', async () => {
    await withStore((store) => {
      const responded: Issue = { ...mockIssue, id: 'I_resp', commentCount: 5, maintainerCommented: true, assignees: [], linkedPrCount: 0 }
      const ignored: Issue = { ...mockIssue, id: 'I_ign', commentCount: 5, maintainerCommented: false, assignees: [], linkedPrCount: 0 }
      store.issues = [responded, ignored]
      store.sortKey = 'critical'
      expect(store.filteredIssues[0]?.id).toBe('I_ign')
    })
  })

  it('newest sort orders by createdAt descending', async () => {
    await withStore((store) => {
      store.issues = [
        { ...mockIssue, id: 'I_old', createdAt: '2025-01-01T00:00:00Z' },
        { ...mockIssue, id: 'I_new', createdAt: '2025-06-01T00:00:00Z' },
      ]
      store.sortKey = 'newest'
      expect(store.filteredIssues[0]?.id).toBe('I_new')
    })
  })

  it('label filter narrows by label name', async () => {
    await withStore((store) => {
      store.issues = [
        { ...mockIssue, id: 'I_1', labels: [{ name: 'bug', color: 'ff0000' }] },
        { ...mockIssue, id: 'I_2', labels: [{ name: 'feature', color: '00ff00' }] },
      ]
      store.activeFilters = ['label:bug']
      expect(store.filteredIssues).toHaveLength(1)
      expect(store.filteredIssues[0]?.id).toBe('I_1')
    })
  })

  it('availableLabels collects unique sorted labels', async () => {
    await withStore((store) => {
      store.issues = [
        { ...mockIssue, id: 'I_1', labels: [{ name: 'bug', color: 'ff0000' }, { name: 'urgent', color: '0000ff' }] },
        { ...mockIssue, id: 'I_2', labels: [{ name: 'bug', color: 'ff0000' }] },
      ]
      expect(store.availableLabels).toEqual(['bug', 'urgent'])
    })
  })
})
