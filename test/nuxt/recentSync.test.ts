import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import type { RecentSyncResult } from '../../shared/types/recent'

// --- Mock state ---

let syncHandler: (body: { items: Array<{ type: string, repo: string, number: number }> }) => RecentSyncResult[] | Promise<RecentSyncResult[]>
  = () => []

registerEndpoint('/api/user/recent-sync', {
  method: 'POST',
  handler: async (event) => {
    const { readBody } = await import('h3')
    const body = await readBody(event)
    return syncHandler(body)
  },
})

// --- Helper ---

const mockLoggedIn = ref(true)

// Override useUserSession to control loggedIn
vi.stubGlobal('useUserSession', () => ({
  loggedIn: mockLoggedIn,
  user: ref(null),
  session: ref({}),
  fetch: vi.fn(),
  clear: vi.fn(),
}))

async function withSync<T>(
  fn: (store: ReturnType<typeof useRecentStore>) => T | Promise<T>,
  options?: { loggedIn?: boolean },
): Promise<T> {
  let result: T
  mockLoggedIn.value = options?.loggedIn ?? true
  const Wrapper = defineComponent({
    async setup() {
      const store = useRecentStore()
      // Reset store state
      store.items = []
      store.favorites = []

      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

// --- Tests ---

describe('useRecentSync', () => {
  it('syncs items on mount when logged in', async () => {
    let calledWith: unknown = null
    syncHandler = (body) => {
      calledWith = body
      return [
        { key: 'issue:org/repo#1', title: 'Issue 1', updatedAt: '2025-06-15T00:00:00Z' },
      ]
    }

    await withSync(async (store) => {
      store.items = [
        {
          key: 'issue:org/repo#1',
          type: 'issue',
          repo: 'org/repo',
          number: 1,
          title: 'Issue 1',
          url: 'https://github.com/org/repo/issues/1',
          visitedAt: 1000,
          updatedAt: 1000,
        },
      ]

      useRecentSync()
      await vi.waitFor(() => {
        expect(calledWith).not.toBeNull()
      }, { timeout: 2000 })

      expect(store.items[0]!.updatedAt).toBe(new Date('2025-06-15T00:00:00Z').getTime())
    })
  })

  it('skips sync when logged out', async () => {
    let called = false
    syncHandler = () => {
      called = true
      return []
    }

    await withSync(async (store) => {
      store.items = [
        {
          key: 'issue:org/repo#1',
          type: 'issue',
          repo: 'org/repo',
          number: 1,
          title: 'Issue 1',
          url: 'u',
          visitedAt: 1000,
          updatedAt: 1000,
        },
      ]

      useRecentSync()
      await new Promise(r => setTimeout(r, 100))

      expect(called).toBe(false)
    }, { loggedIn: false })
  })

  it('skips sync when no items', async () => {
    let called = false
    syncHandler = () => {
      called = true
      return []
    }

    await withSync(async () => {
      useRecentSync()
      await new Promise(r => setTimeout(r, 100))

      expect(called).toBe(false)
    })
  })

  it('applies title rename from sync', async () => {
    syncHandler = () => [
      { key: 'issue:org/repo#1', title: 'Renamed title', updatedAt: '2025-06-15T00:00:00Z' },
    ]

    await withSync(async (store) => {
      store.items = [
        {
          key: 'issue:org/repo#1',
          type: 'issue',
          repo: 'org/repo',
          number: 1,
          title: 'Original title',
          url: 'u',
          visitedAt: 1000,
          updatedAt: 1000,
        },
      ]

      useRecentSync()
      await vi.waitFor(() => {
        expect(store.items[0]!.title).toBe('Renamed title')
      }, { timeout: 2000 })

      expect(store.items[0]!.previousTitle).toBe('Original title')
    })
  })

  it('handles fetch errors without crashing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    syncHandler = () => {
      throw new Error('Network error')
    }

    await withSync(async (store) => {
      store.items = [
        {
          key: 'issue:org/repo#1',
          type: 'issue',
          repo: 'org/repo',
          number: 1,
          title: 'Issue 1',
          url: 'u',
          visitedAt: 1000,
          updatedAt: 1000,
        },
      ]

      useRecentSync()
      await new Promise(r => setTimeout(r, 200))

      expect(store.items[0]!.title).toBe('Issue 1')
    })

    warnSpy.mockRestore()
  })
})
