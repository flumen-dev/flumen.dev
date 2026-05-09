import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { readBody as h3ReadBody } from 'h3'

let serverState: Bookmark[] = []

registerEndpoint('/api/user/bookmarks', {
  method: 'GET',
  handler: () => serverState,
})

registerEndpoint('/api/user/bookmarks', {
  method: 'PUT',
  handler: async (event) => {
    const body = await h3ReadBody(event) as Omit<Bookmark, 'addedAt'>
    serverState = [{ ...body, addedAt: Date.now() } as Bookmark, ...serverState.filter(b => b.id !== body.id)]
    return serverState
  },
})

registerEndpoint('/api/user/bookmarks', {
  method: 'DELETE',
  handler: (event: { path: string }) => {
    const id = new URL(event.path, 'http://localhost').searchParams.get('id')
    if (id) serverState = serverState.filter(b => b.id !== id)
    return serverState
  },
})

async function withStore<T>(fn: (store: ReturnType<typeof useBookmarkStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useBookmarkStore()
      store.items = []
      store.loaded = false
      store.loading = false
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('bookmarkStore', () => {
  it('loadIfNeeded fetches once', async () => {
    serverState = [
      { type: 'issue', id: 'issue:o/r#1', title: 'X', repo: 'o/r', number: 1, url: '/x', addedAt: 1 },
    ]
    await withStore(async (store) => {
      await store.loadIfNeeded()
      expect(store.items).toHaveLength(1)
      expect(store.loaded).toBe(true)
      // Second call is a no-op
      await store.loadIfNeeded()
      expect(store.items).toHaveLength(1)
    })
  })

  it('isBookmarked reflects current state', async () => {
    serverState = []
    await withStore(async (store) => {
      store.items = [
        { type: 'repo', id: 'repo:o/r', title: 'r', repo: 'o/r', url: '/r', addedAt: 1 },
      ]
      expect(store.isBookmarked('repo:o/r')).toBe(true)
      expect(store.isBookmarked('repo:o/x')).toBe(false)
    })
  })

  it('toggleBookmark adds optimistically and confirms', async () => {
    serverState = []
    await withStore(async (store) => {
      const id = bookmarkId('issue', 'o/r', 5)
      const promise = store.toggleBookmark({
        type: 'issue', id, title: 'T', repo: 'o/r', number: 5, url: '/i/5',
      })
      expect(store.isBookmarked(id)).toBe(true)
      await promise
      expect(store.isBookmarked(id)).toBe(true)
      expect(serverState.some(b => b.id === id)).toBe(true)
    })
  })

  it('toggleBookmark removes when already present', async () => {
    const id = bookmarkId('repo', 'o/r')
    serverState = [{ type: 'repo', id, title: 'r', repo: 'o/r', url: '/r', addedAt: 1 }]
    await withStore(async (store) => {
      store.items = [...serverState]
      const promise = store.toggleBookmark({ type: 'repo', id, title: 'r', repo: 'o/r', url: '/r' })
      expect(store.isBookmarked(id)).toBe(false)
      await promise
      expect(serverState).toHaveLength(0)
    })
  })

  it('removeBookmark deletes by id', async () => {
    const id = bookmarkId('pr', 'o/r', 9)
    serverState = [{ type: 'pr', id, title: 'p', repo: 'o/r', number: 9, url: '/p/9', addedAt: 1 }]
    await withStore(async (store) => {
      store.items = [...serverState]
      await store.removeBookmark(id)
      expect(store.isBookmarked(id)).toBe(false)
      expect(serverState).toHaveLength(0)
    })
  })

  it('byType groups items by their type', async () => {
    await withStore((store) => {
      store.items = [
        { type: 'issue', id: 'i1', title: 'a', repo: 'o/r', number: 1, url: '/a', addedAt: 1 },
        { type: 'pr', id: 'p1', title: 'b', repo: 'o/r', number: 2, url: '/b', addedAt: 2 },
        { type: 'repo', id: 'r1', title: 'c', repo: 'o/r', url: '/c', addedAt: 3 },
        { type: 'issue', id: 'i2', title: 'd', repo: 'o/r', number: 4, url: '/d', addedAt: 4 },
      ]
      expect(store.byType.issue).toHaveLength(2)
      expect(store.byType.pr).toHaveLength(1)
      expect(store.byType.repo).toHaveLength(1)
    })
  })
})
