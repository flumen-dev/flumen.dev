import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { readBody as h3ReadBody } from 'h3'

// --- Mock endpoints ---

const mockStarsData: Record<string, { starred: boolean, count: number }> = {
  'org/repo-a': { starred: true, count: 42 },
  'org/repo-b': { starred: false, count: 7 },
}

registerEndpoint('/api/repository/stars', {
  method: 'GET',
  handler: (event: { path: string }) => {
    const url = new URL(event.path, 'http://localhost')
    const repos = url.searchParams.get('repos')?.split(',') ?? []
    const result: Record<string, { starred: boolean, count: number }> = {}
    for (const r of repos) {
      if (mockStarsData[r]) result[r] = mockStarsData[r]
    }
    return result
  },
})

let starPutHandler = (_body: { repo: string, starred: boolean }) => ({
  viewerHasStarred: true,
  stargazerCount: 43,
})

registerEndpoint('/api/repository/star', {
  method: 'PUT',
  handler: async (event) => {
    const body = await h3ReadBody(event)
    return starPutHandler(body)
  },
})

// --- Helper ---

async function withStore<T>(fn: (store: ReturnType<typeof useStarStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useStarStore()
      // Reset state
      store.entries = {}
      store.pending = {}
      store.loading = {}
      store.failed = {}
      store.persistedAt = 0
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

// --- Tests ---

describe('starStore — getters', () => {
  it('returns defaults for unknown repos', async () => {
    await withStore((store) => {
      expect(store.isStarred('unknown/repo')).toBe(false)
      expect(store.starCount('unknown/repo')).toBe(0)
      expect(store.isLoaded('unknown/repo')).toBe(false)
      expect(store.isPending('unknown/repo')).toBe(false)
      expect(store.isLoading('unknown/repo')).toBe(false)
      expect(store.hasFailed('unknown/repo')).toBe(false)
    })
  })

  it('returns correct values for loaded repos', async () => {
    await withStore((store) => {
      store.entries = {
        'org/repo-a': { starred: true, count: 42 },
        'org/repo-b': { starred: false, count: 7 },
      }
      expect(store.isStarred('org/repo-a')).toBe(true)
      expect(store.isStarred('org/repo-b')).toBe(false)
      expect(store.starCount('org/repo-a')).toBe(42)
      expect(store.starCount('org/repo-b')).toBe(7)
      expect(store.isLoaded('org/repo-a')).toBe(true)
      expect(store.isLoaded('org/repo-b')).toBe(true)
    })
  })
})

describe('starStore — request batching', () => {
  it('does not queue repos that are already loaded', async () => {
    await withStore(async (store) => {
      store.entries = { 'org/repo-a': { starred: true, count: 10 } }
      store.persistedAt = Date.now()
      store.request('org/repo-a')
      // Should not be loading since already in entries
      expect(store.isLoading('org/repo-a')).toBe(false)
    })
  })

  it('fetches missing repos after debounce', async () => {
    await withStore(async (store) => {
      store.request('org/repo-a')
      store.request('org/repo-b')

      // Wait for debounce + fetch
      await vi.waitFor(() => {
        expect(store.isLoaded('org/repo-a')).toBe(true)
      }, { timeout: 1000 })

      expect(store.isStarred('org/repo-a')).toBe(true)
      expect(store.starCount('org/repo-a')).toBe(42)
      expect(store.isStarred('org/repo-b')).toBe(false)
      expect(store.starCount('org/repo-b')).toBe(7)
    })
  })
})

describe('starStore — toggleStar', () => {
  it('optimistically updates then confirms from server', async () => {
    starPutHandler = () => ({ viewerHasStarred: true, stargazerCount: 43 })

    await withStore(async (store) => {
      store.entries = { 'org/repo-a': { starred: false, count: 42 } }

      const promise = store.toggleStar('org/repo-a')

      // Optimistic: immediately starred with count + 1
      expect(store.isStarred('org/repo-a')).toBe(true)
      expect(store.starCount('org/repo-a')).toBe(43)
      expect(store.isPending('org/repo-a')).toBe(true)

      await promise

      // Server confirmed
      expect(store.isStarred('org/repo-a')).toBe(true)
      expect(store.starCount('org/repo-a')).toBe(43)
      expect(store.isPending('org/repo-a')).toBe(false)
    })
  })

  it('does nothing if repo is not loaded', async () => {
    await withStore(async (store) => {
      await store.toggleStar('unknown/repo')
      expect(store.isLoaded('unknown/repo')).toBe(false)
    })
  })

  it('does nothing if already pending', async () => {
    await withStore(async (store) => {
      store.entries = { 'org/repo-a': { starred: true, count: 10 } }
      store.pending = { 'org/repo-a': true }

      await store.toggleStar('org/repo-a')
      // Should still be starred (no change)
      expect(store.isStarred('org/repo-a')).toBe(true)
      expect(store.starCount('org/repo-a')).toBe(10)
    })
  })
})

describe('starStore — TTL expiry', () => {
  it('clears entries when persisted data is expired', async () => {
    await withStore((store) => {
      store.entries = { 'org/old': { starred: true, count: 5 } }
      store.persistedAt = Date.now() - 20 * 60 * 1000 // 20 min ago

      store.request('org/new')

      // Old entries should be cleared
      expect(store.isLoaded('org/old')).toBe(false)
    })
  })

  it('keeps entries when still within TTL', async () => {
    await withStore((store) => {
      store.entries = { 'org/recent': { starred: true, count: 5 } }
      store.persistedAt = Date.now() - 5 * 60 * 1000 // 5 min ago

      store.request('org/new')

      // Recent entries should still be there
      expect(store.isLoaded('org/recent')).toBe(true)
    })
  })
})
