import { describe, expect, it } from 'vitest'
import type { RecentItem } from '../../shared/types/recent'

// Test the pure logic behind the recent store's context-menu actions:
// remove, addFavorite, removeFavorite.
// We mirror the store's array operations without Pinia.

function makeItem(key: string, type: 'issue' | 'pr' = 'issue'): RecentItem {
  return {
    key,
    type,
    repo: 'owner/repo',
    number: Number(key.split('#')[1]) || 1,
    title: `Item ${key}`,
    url: `https://github.com/owner/repo/issues/1`,
    visitedAt: Date.now(),
    updatedAt: Date.now() - 1000,
  }
}

// --- remove ---

describe('remove', () => {
  function remove(items: RecentItem[], favorites: RecentItem[], key: string) {
    return {
      items: items.filter(i => i.key !== key),
      favorites: favorites.filter(i => i.key !== key),
    }
  }

  it('removes from recent items', () => {
    const items = [makeItem('issue:a#1'), makeItem('issue:b#2')]
    const result = remove(items, [], 'issue:a#1')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.key).toBe('issue:b#2')
  })

  it('removes from favorites', () => {
    const favs = [makeItem('pr:a#1'), makeItem('pr:b#2')]
    const result = remove([], favs, 'pr:a#1')
    expect(result.favorites).toHaveLength(1)
    expect(result.favorites[0]!.key).toBe('pr:b#2')
  })

  it('removes from both lists if duplicated', () => {
    const item = makeItem('issue:a#1')
    const result = remove([item], [{ ...item }], 'issue:a#1')
    expect(result.items).toHaveLength(0)
    expect(result.favorites).toHaveLength(0)
  })

  it('no-op when key not found', () => {
    const items = [makeItem('issue:a#1')]
    const result = remove(items, [], 'issue:z#99')
    expect(result.items).toHaveLength(1)
  })
})

// --- addFavorite ---

describe('addFavorite', () => {
  function addFavorite(items: RecentItem[], favorites: RecentItem[], key: string) {
    const idx = items.findIndex(i => i.key === key)
    if (idx === -1) return { items, favorites }
    const [item] = items.splice(idx, 1)
    return {
      items: [...items],
      favorites: [...favorites, item!],
    }
  }

  it('moves item from recent to favorites', () => {
    const items = [makeItem('issue:a#1'), makeItem('issue:b#2')]
    const result = addFavorite([...items], [], 'issue:a#1')
    expect(result.items).toHaveLength(1)
    expect(result.favorites).toHaveLength(1)
    expect(result.favorites[0]!.key).toBe('issue:a#1')
  })

  it('no-op when key not in recent', () => {
    const items = [makeItem('issue:a#1')]
    const result = addFavorite(items, [], 'issue:z#99')
    expect(result.items).toHaveLength(1)
    expect(result.favorites).toHaveLength(0)
  })
})

// --- removeFavorite ---

describe('removeFavorite', () => {
  function removeFavorite(items: RecentItem[], favorites: RecentItem[], key: string) {
    const idx = favorites.findIndex(i => i.key === key)
    if (idx === -1) return { items, favorites }
    const [item] = favorites.splice(idx, 1)
    return {
      items: [item!, ...items],
      favorites: [...favorites],
    }
  }

  it('moves item from favorites back to recent (prepended)', () => {
    const existing = makeItem('issue:b#2')
    const fav = makeItem('issue:a#1')
    const result = removeFavorite([existing], [fav], 'issue:a#1')
    expect(result.favorites).toHaveLength(0)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.key).toBe('issue:a#1')
    expect(result.items[1]!.key).toBe('issue:b#2')
  })

  it('no-op when key not in favorites', () => {
    const result = removeFavorite([], [makeItem('issue:a#1')], 'issue:z#99')
    expect(result.favorites).toHaveLength(1)
  })
})
