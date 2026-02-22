import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { CreatedIssueItem } from '../../server/api/focus/created.get'
import type { InboxItem } from '../../shared/types/inbox'

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
    inboxReviewRequests: 2,
    inboxAssigned: 1,
    inboxMentions: 1,
    inboxHasNew: true,
  }),
})

// --- Inbox mock data ---

function makeInboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    type: 'pr',
    number: 1,
    title: 'Fix bug',
    state: 'OPEN',
    url: 'https://github.com/org/repo/pull/1',
    repo: 'org/repo',
    updatedAt: '2025-01-10T00:00:00Z',
    author: { login: 'dev', avatarUrl: '' },
    labels: [],
    ...overrides,
  }
}

const mockReviewItems: InboxItem[] = [
  makeInboxItem({ number: 1, title: 'Review PR 1', repo: 'org/repo' }),
  makeInboxItem({ number: 2, title: 'Review PR 2', repo: 'org/other' }),
]
const mockAssignedItems: InboxItem[] = [
  makeInboxItem({ number: 10, title: 'Assigned issue', type: 'issue', repo: 'org/repo' }),
]
const mockMentionItems: InboxItem[] = [
  makeInboxItem({ number: 1, title: 'Review PR 1', repo: 'org/repo' }),
]

let inboxCallCount = 0
let dismissCalls = 0
let restoreCalls = 0
let seenCalls = 0

registerEndpoint('/api/focus/inbox', {
  method: 'GET',
  handler: (event: { path: string }) => {
    inboxCallCount++
    const url = new URL(event.path, 'http://localhost')
    const category = url.searchParams.get('category') ?? 'reviewRequests'
    const search = url.searchParams.get('search')

    const dataMap: Record<string, InboxItem[]> = {
      reviewRequests: mockReviewItems,
      assigned: mockAssignedItems,
      mentions: mockMentionItems,
    }

    let items = dataMap[category] ?? []
    if (search) {
      items = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()))
    }

    return {
      items,
      totalCount: items.length,
      pageInfo: { hasNextPage: false, endCursor: null },
    }
  },
})

registerEndpoint('/api/focus/inbox-dismiss', {
  method: 'PUT',
  handler: () => {
    dismissCalls++
    return { ok: true }
  },
})

registerEndpoint('/api/focus/inbox-restore', {
  method: 'PUT',
  handler: () => {
    restoreCalls++
    return { ok: true }
  },
})

registerEndpoint('/api/focus/inbox-seen', {
  method: 'PUT',
  handler: () => {
    seenCalls++
    return { ok: true }
  },
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
        inboxReviewRequests: 2,
        inboxAssigned: 1,
        inboxMentions: 1,
        inboxHasNew: true,
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

  // --- Inbox: data fetching ---

  it('toggle inbox fetches all 3 categories in parallel', async () => {
    await withStore(async (store) => {
      inboxCallCount = 0
      await store.toggle('inbox')

      expect(inboxCallCount).toBe(3)
      expect(store.inboxReviewRequests.data).toHaveLength(2)
      expect(store.inboxAssigned.data).toHaveLength(1)
      expect(store.inboxMentions.data).toHaveLength(1)
    })
  })

  it('inbox unified loading state reflects all categories', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')
      expect(store.inbox.fetchedAt).not.toBeNull()
      expect(store.inbox.loading).toBe(false)
    })
  })

  // --- Inbox: dismiss / restore ---

  it('dismissInboxItem marks item as dismissed across all categories', async () => {
    await withStore(async (store) => {
      dismissCalls = 0
      await store.toggle('inbox')

      // Item org/repo#1 exists in both reviewRequests and mentions
      await store.dismissInboxItem('org/repo', 1)

      const reviewItem = store.inboxReviewRequests.data.find(i => i.number === 1)
      const mentionItem = store.inboxMentions.data.find(i => i.number === 1)
      expect(reviewItem?.isDismissed).toBe(true)
      expect(mentionItem?.isDismissed).toBe(true)
      expect(dismissCalls).toBe(1)
    })
  })

  it('restoreInboxItem marks item as not dismissed across all categories', async () => {
    await withStore(async (store) => {
      restoreCalls = 0
      await store.toggle('inbox')
      await store.dismissInboxItem('org/repo', 1)

      await store.restoreInboxItem('org/repo', 1)

      const reviewItem = store.inboxReviewRequests.data.find(i => i.number === 1)
      const mentionItem = store.inboxMentions.data.find(i => i.number === 1)
      expect(reviewItem?.isDismissed).toBe(false)
      expect(mentionItem?.isDismissed).toBe(false)
      expect(restoreCalls).toBe(1)
    })
  })

  it('dismissInboxItem does not affect items in other repos', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')
      await store.dismissInboxItem('org/repo', 1)

      const otherItem = store.inboxReviewRequests.data.find(i => i.number === 2)
      expect(otherItem?.isDismissed).toBeFalsy()
    })
  })

  // --- Inbox: filter ---

  it('filterInbox filters client-side when all items loaded', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')
      inboxCallCount = 0

      await store.filterInbox('reviewRequests', 'PR 1', [])
      expect(store.inboxReviewRequests.data).toHaveLength(1)
      expect(store.inboxReviewRequests.data[0]!.title).toBe('Review PR 1')
      expect(inboxCallCount).toBe(0) // no API call — client-side
    })
  })

  it('filterInbox restores from cache when filter is cleared', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')

      await store.filterInbox('reviewRequests', 'PR 1', [])
      expect(store.inboxReviewRequests.data).toHaveLength(1)

      await store.filterInbox('reviewRequests', '', [])
      expect(store.inboxReviewRequests.data).toHaveLength(2) // restored
    })
  })

  it('filterInbox filters by repo client-side', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')
      inboxCallCount = 0

      await store.filterInbox('reviewRequests', '', ['org/other'])
      expect(store.inboxReviewRequests.data).toHaveLength(1)
      expect(store.inboxReviewRequests.data[0]!.repo).toBe('org/other')
      expect(inboxCallCount).toBe(0)
    })
  })

  // --- Inbox: markInboxSeen ---

  it('markInboxSeen calls the API', async () => {
    await withStore(async (store) => {
      seenCalls = 0
      await store.markInboxSeen()
      expect(seenCalls).toBe(1)
    })
  })

  // --- Inbox: staleness ---

  it('toggle inbox does not refetch within staleness window', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')
      inboxCallCount = 0

      await store.toggle('inbox') // collapse
      await store.toggle('inbox') // re-expand
      expect(inboxCallCount).toBe(0) // cached, not stale
    })
  })

  it('refreshSection inbox refetches all categories', async () => {
    await withStore(async (store) => {
      await store.toggle('inbox')
      inboxCallCount = 0

      await store.refreshSection('inbox')
      expect(inboxCallCount).toBe(3)
    })
  })
})
