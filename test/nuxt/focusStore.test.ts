import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { CreatedIssueItem } from '../../server/api/focus/created.get'

const mockCreatedItem: CreatedIssueItem = {
  id: 'I_1',
  number: 10,
  title: 'Created issue',
  state: 'OPEN',
  stateReason: null,
  url: 'https://github.com/org/repo/issues/10',
  repo: 'org/repo',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-10T00:00:00Z',
  labels: [],
  assignees: [],
  commentCount: 0,
  reactions: { totalCount: 0, thumbsUp: 0, thumbsDown: 0, laugh: 0, hooray: 0, heart: 0, rocket: 0, eyes: 0, confused: 0 },
  linkedPrs: [],
  needsResponse: false,
  lastCommentAuthor: null,
  lastCommentAt: null,
}

const mockClosedItem: CreatedIssueItem = {
  ...mockCreatedItem,
  id: 'I_2',
  number: 5,
  title: 'Closed issue',
  state: 'CLOSED',
  stateReason: 'COMPLETED',
}

let createdCallCount = 0

registerEndpoint('/api/focus/created', {
  method: 'GET',
  handler: (event: { path: string }) => {
    createdCallCount++
    const url = new URL(event.path, 'http://localhost')
    const state = url.searchParams.get('state') ?? 'open'
    const after = url.searchParams.get('after')

    if (state === 'closed') {
      return {
        items: [mockClosedItem],
        totalCount: 1,
        pageInfo: { hasNextPage: false, endCursor: null },
      }
    }

    // Simulate pagination: first page has cursor, second page is last
    if (!after) {
      return {
        items: [mockCreatedItem],
        totalCount: 2,
        pageInfo: { hasNextPage: true, endCursor: 'cursor_page1' },
      }
    }
    return {
      items: [{ ...mockCreatedItem, id: 'I_3', number: 11, title: 'Page 2 issue' }],
      totalCount: 2,
      pageInfo: { hasNextPage: false, endCursor: null },
    }
  },
})

registerEndpoint('/api/focus/working-on', {
  method: 'GET',
  handler: () => ({ items: [] }),
})

registerEndpoint('/api/focus/counts', {
  method: 'GET',
  handler: () => ({
    workingOn: 3,
    createdOpen: 12,
    createdClosed: 45,
  }),
})

async function withStore<T>(fn: (store: ReturnType<typeof useFocusStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useFocusStore()
      // Reset store state
      store.expanded = null
      store.createdStateFilter = 'open'
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('focusStore', () => {
  // --- Toggle / lazy fetch ---

  it('toggle expands a section', async () => {
    await withStore(async (store) => {
      await store.toggle('workingOn')
      expect(store.expanded).toBe('workingOn')
    })
  })

  it('toggle collapses when clicking the same section', async () => {
    await withStore(async (store) => {
      await store.toggle('workingOn')
      await store.toggle('workingOn')
      expect(store.expanded).toBeNull()
    })
  })

  it('toggle switches to a different section', async () => {
    await withStore(async (store) => {
      await store.toggle('workingOn')
      await store.toggle('created')
      expect(store.expanded).toBe('created')
    })
  })

  // --- Created: data fetching ---

  it('toggle created fetches open issues', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      expect(store.created.data).toHaveLength(1)
      expect(store.created.data[0]!.title).toBe('Created issue')
      expect(store.createdTotalCount).toBe(2)
    })
  })

  // --- Created: pagination ---

  it('createdNextPage loads next page', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      expect(store.createdHasMore).toBe(true)
      expect(store.createdPage).toBe(1)

      await store.createdNextPage()
      expect(store.createdPage).toBe(2)
      expect(store.created.data[0]!.title).toBe('Page 2 issue')
      expect(store.createdHasMore).toBe(false)
    })
  })

  it('createdPrevPage goes back', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      await store.createdNextPage()
      expect(store.createdPage).toBe(2)

      await store.createdPrevPage()
      expect(store.createdPage).toBe(1)
      expect(store.created.data[0]!.title).toBe('Created issue')
    })
  })

  it('createdHasPrevious is false on first page', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      expect(store.createdHasPrevious).toBe(false)
    })
  })

  it('createdHasPrevious is true after navigating forward', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      await store.createdNextPage()
      expect(store.createdHasPrevious).toBe(true)
    })
  })

  // --- Created: filter switching ---

  it('setCreatedFilter switches to closed and fetches', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      expect(store.created.data[0]!.state).toBe('OPEN')

      await store.setCreatedFilter('closed')
      expect(store.createdStateFilter).toBe('closed')
      expect(store.created.data[0]!.state).toBe('CLOSED')
      expect(store.created.data[0]!.title).toBe('Closed issue')
    })
  })

  it('setCreatedFilter does nothing when already on that filter', async () => {
    await withStore(async (store) => {
      createdCallCount = 0
      await store.toggle('created')
      const callsAfterToggle = createdCallCount

      await store.setCreatedFilter('open') // already open
      expect(createdCallCount).toBe(callsAfterToggle) // no extra call
    })
  })

  it('switching back to open uses cached data (no refetch within staleness window)', async () => {
    await withStore(async (store) => {
      await store.toggle('created') // fetches open
      await store.setCreatedFilter('closed') // fetches closed
      createdCallCount = 0

      await store.setCreatedFilter('open') // open was cached
      expect(createdCallCount).toBe(0) // no extra call
      expect(store.created.data[0]!.state).toBe('OPEN')
    })
  })

  // --- Created: refresh ---

  it('refreshSection resets pagination and refetches', async () => {
    await withStore(async (store) => {
      await store.toggle('created')
      await store.createdNextPage()
      expect(store.createdPage).toBe(2)

      await store.refreshSection('created')
      expect(store.createdPage).toBe(1)
      expect(store.created.data[0]!.title).toBe('Created issue')
    })
  })

  // --- Counts ---

  it('fetchCounts loads lightweight counts', async () => {
    await withStore(async (store) => {
      expect(store.counts).toBeNull()

      await store.fetchCounts()
      expect(store.counts).toEqual({
        workingOn: 3,
        createdOpen: 12,
        createdClosed: 45,
      })
    })
  })

  it('fetchCounts does not refetch within staleness window', async () => {
    await withStore(async (store) => {
      await store.fetchCounts()
      const firstFetchedCounts = store.counts

      await store.fetchCounts() // should be cached
      expect(store.counts).toBe(firstFetchedCounts) // same reference
    })
  })

  it('full section fetch takes priority over counts', async () => {
    await withStore(async (store) => {
      await store.fetchCounts()
      expect(store.counts!.createdOpen).toBe(12)

      // Full fetch returns totalCount: 2 (different from counts' 12)
      await store.toggle('created')
      expect(store.createdTotalCount).toBe(2) // full data wins
    })
  })
})
