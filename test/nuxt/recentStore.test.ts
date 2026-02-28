import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { RecentItem, RecentItemType } from '../../shared/types/recent'

function makeItem(overrides: Partial<RecentItem> & { key: string }): RecentItem {
  return {
    type: 'issue' as RecentItemType,
    repo: 'org/repo',
    number: 1,
    title: 'Test item',
    url: 'https://github.com/org/repo/issues/1',
    visitedAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

async function withStore<T>(fn: (store: ReturnType<typeof useRecentStore>) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      const store = useRecentStore()
      // Reset state
      store.items = []
      store.favorites = []
      result = await fn(store)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('recentStore', () => {
  // --- track() ---

  describe('track()', () => {
    it('adds a new item to the front', async () => {
      await withStore((store) => {
        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'Issue 1', url: 'https://github.com/org/repo/issues/1' })

        expect(store.items).toHaveLength(1)
        expect(store.items[0]!.key).toBe('issue:org/repo#1')
        expect(store.items[0]!.title).toBe('Issue 1')
      })
    })

    it('re-visit moves item to front and updates visitedAt', async () => {
      await withStore((store) => {
        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'Issue 1', url: 'u' })
        store.track({ type: 'issue', repo: 'org/repo', number: 2, title: 'Issue 2', url: 'u' })

        const beforeVisitedAt = store.items[1]!.visitedAt
        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'Issue 1', url: 'u' })

        expect(store.items[0]!.key).toBe('issue:org/repo#1')
        expect(store.items[0]!.visitedAt).toBeGreaterThanOrEqual(beforeVisitedAt)
      })
    })

    it('re-visit clears previousTitle', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1', previousTitle: 'Old title' })]

        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'New title', url: 'u' })

        expect(store.items[0]!.previousTitle).toBeUndefined()
      })
    })

    it('tracking a favorite updates in-place without moving to recent', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'issue:org/repo#1', title: 'Old' })]

        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'Updated', url: 'u' })

        expect(store.favorites).toHaveLength(1)
        expect(store.favorites[0]!.title).toBe('Updated')
        expect(store.items).toHaveLength(0)
      })
    })

    it('evicts oldest item at capacity (30)', async () => {
      await withStore((store) => {
        for (let i = 0; i < 30; i++) {
          store.track({ type: 'issue', repo: 'org/repo', number: i, title: `Item ${i}`, url: 'u' })
        }
        expect(store.items).toHaveLength(30)

        store.track({ type: 'issue', repo: 'org/repo', number: 99, title: 'New', url: 'u' })

        expect(store.items).toHaveLength(30)
        expect(store.items[0]!.key).toBe('issue:org/repo#99')
        expect(store.items.find(i => i.number === 0)).toBeUndefined()
      })
    })

    it('merges meta on re-visit', async () => {
      await withStore((store) => {
        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'T', url: 'u', meta: { label: 'bug' } })
        store.track({ type: 'issue', repo: 'org/repo', number: 1, title: 'T', url: 'u', meta: { priority: 'high' } })

        expect(store.items[0]!.meta).toEqual({ label: 'bug', priority: 'high' })
      })
    })
  })

  // --- applySync() ---

  describe('applySync()', () => {
    it('sets previousTitle on title rename', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1', title: 'Old title', updatedAt: 1000 })]

        store.applySync([{ key: 'issue:org/repo#1', title: 'New title', updatedAt: '2025-01-10T00:00:00Z' }])

        expect(store.items[0]!.previousTitle).toBe('Old title')
        expect(store.items[0]!.title).toBe('New title')
      })
    })

    it('updates updatedAt from server', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1', updatedAt: 1000 })]

        const serverDate = '2025-06-15T12:00:00Z'
        store.applySync([{ key: 'issue:org/repo#1', title: 'Test item', updatedAt: serverDate }])

        expect(store.items[0]!.updatedAt).toBe(new Date(serverDate).getTime())
      })
    })

    it('no-op when title and updatedAt are unchanged', async () => {
      await withStore((store) => {
        const ts = new Date('2025-01-01T00:00:00Z').getTime()
        store.items = [makeItem({ key: 'issue:org/repo#1', title: 'Same', updatedAt: ts })]

        const refBefore = store.items
        store.applySync([{ key: 'issue:org/repo#1', title: 'Same', updatedAt: '2025-01-01T00:00:00Z' }])

        expect(store.items).toBe(refBefore)
      })
    })

    it('works on favorites list', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'pr:org/repo#5', title: 'Old PR', updatedAt: 1000 })]

        store.applySync([{ key: 'pr:org/repo#5', title: 'Renamed PR', updatedAt: '2025-06-15T00:00:00Z' }])

        expect(store.favorites[0]!.title).toBe('Renamed PR')
        expect(store.favorites[0]!.previousTitle).toBe('Old PR')
      })
    })
  })

  // --- markSeen() ---

  describe('markSeen()', () => {
    it('updates visitedAt and clears previousTitle', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1', visitedAt: 1000, previousTitle: 'Old' })]

        store.markSeen('issue:org/repo#1')

        expect(store.items[0]!.visitedAt).toBeGreaterThan(1000)
        expect(store.items[0]!.previousTitle).toBeUndefined()
      })
    })

    it('works on favorites', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'issue:org/repo#1', visitedAt: 1000, previousTitle: 'Old' })]

        store.markSeen('issue:org/repo#1')

        expect(store.favorites[0]!.visitedAt).toBeGreaterThan(1000)
        expect(store.favorites[0]!.previousTitle).toBeUndefined()
      })
    })

    it('no-op for unknown key', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1' })]

        store.markSeen('issue:org/repo#999')

        expect(store.items).toHaveLength(1)
      })
    })
  })

  // --- hasUpdate() ---

  describe('hasUpdate()', () => {
    it('returns true when updatedAt > visitedAt', async () => {
      await withStore((store) => {
        const item = makeItem({ key: 'issue:org/repo#1', updatedAt: 2000, visitedAt: 1000 })
        expect(store.hasUpdate(item)).toBe(true)
      })
    })

    it('returns false when updatedAt <= visitedAt', async () => {
      await withStore((store) => {
        const item = makeItem({ key: 'issue:org/repo#1', updatedAt: 1000, visitedAt: 1000 })
        expect(store.hasUpdate(item)).toBe(false)
      })
    })
  })

  // --- addFavorite() / removeFavorite() ---

  describe('addFavorite()', () => {
    it('moves item from recent to favorites', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1' })]

        store.addFavorite('issue:org/repo#1')

        expect(store.items).toHaveLength(0)
        expect(store.favorites).toHaveLength(1)
        expect(store.favorites[0]!.key).toBe('issue:org/repo#1')
      })
    })

    it('no-op for unknown key', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1' })]

        store.addFavorite('issue:org/repo#999')

        expect(store.items).toHaveLength(1)
        expect(store.favorites).toHaveLength(0)
      })
    })
  })

  describe('removeFavorite()', () => {
    it('moves item from favorites back to recent', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'issue:org/repo#1' })]

        store.removeFavorite('issue:org/repo#1')

        expect(store.favorites).toHaveLength(0)
        expect(store.items).toHaveLength(1)
        expect(store.items[0]!.key).toBe('issue:org/repo#1')
      })
    })

    it('evicts oldest recent item if at capacity', async () => {
      await withStore((store) => {
        for (let i = 0; i < 30; i++) {
          store.items.push(makeItem({ key: `issue:org/repo#${i}`, number: i }))
        }
        store.favorites = [makeItem({ key: 'issue:org/repo#99', number: 99 })]

        store.removeFavorite('issue:org/repo#99')

        expect(store.items).toHaveLength(30)
        expect(store.items[0]!.key).toBe('issue:org/repo#99')
        expect(store.items.find(i => i.number === 29)).toBeUndefined()
      })
    })

    it('no-op for unknown key', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'issue:org/repo#1' })]

        store.removeFavorite('issue:org/repo#999')

        expect(store.favorites).toHaveLength(1)
      })
    })
  })

  // --- remove() ---

  describe('remove()', () => {
    it('removes from items', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1' }), makeItem({ key: 'issue:org/repo#2', number: 2 })]

        store.remove('issue:org/repo#1')

        expect(store.items).toHaveLength(1)
        expect(store.items[0]!.key).toBe('issue:org/repo#2')
      })
    })

    it('removes from favorites', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'issue:org/repo#1' })]

        store.remove('issue:org/repo#1')

        expect(store.favorites).toHaveLength(0)
      })
    })
  })

  // --- moveItem() / moveFavorite() ---

  describe('moveItem()', () => {
    it('reorders items', async () => {
      await withStore((store) => {
        store.items = [
          makeItem({ key: 'issue:org/repo#1' }),
          makeItem({ key: 'issue:org/repo#2', number: 2 }),
          makeItem({ key: 'issue:org/repo#3', number: 3 }),
        ]

        store.moveItem(0, 2)

        expect(store.items[0]!.key).toBe('issue:org/repo#2')
        expect(store.items[1]!.key).toBe('issue:org/repo#3')
        expect(store.items[2]!.key).toBe('issue:org/repo#1')
      })
    })

    it('no-op when same index', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1' }), makeItem({ key: 'issue:org/repo#2', number: 2 })]
        const before = store.items.map(i => i.key)

        store.moveItem(0, 0)

        expect(store.items.map(i => i.key)).toEqual(before)
      })
    })
  })

  describe('moveFavorite()', () => {
    it('reorders favorites', async () => {
      await withStore((store) => {
        store.favorites = [
          makeItem({ key: 'issue:org/repo#1' }),
          makeItem({ key: 'issue:org/repo#2', number: 2 }),
        ]

        store.moveFavorite(0, 1)

        expect(store.favorites[0]!.key).toBe('issue:org/repo#2')
        expect(store.favorites[1]!.key).toBe('issue:org/repo#1')
      })
    })

    it('no-op when same index', async () => {
      await withStore((store) => {
        store.favorites = [makeItem({ key: 'issue:org/repo#1' }), makeItem({ key: 'issue:org/repo#2', number: 2 })]
        const before = store.favorites.map(i => i.key)

        store.moveFavorite(0, 0)

        expect(store.favorites.map(i => i.key)).toEqual(before)
      })
    })
  })

  // --- clear() ---

  describe('clear()', () => {
    it('empties items but keeps favorites', async () => {
      await withStore((store) => {
        store.items = [makeItem({ key: 'issue:org/repo#1' })]
        store.favorites = [makeItem({ key: 'issue:org/repo#2', number: 2 })]

        store.clear()

        expect(store.items).toHaveLength(0)
        expect(store.favorites).toHaveLength(1)
      })
    })
  })
})
