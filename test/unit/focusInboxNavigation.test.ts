import { describe, expect, it } from 'vitest'
import type { UnifiedInboxItem } from '../../shared/types/inbox'

// Test the pure logic that powers keyboard navigation + dismiss.
// The store uses these same patterns; we extract them here to test without Pinia.

function makeItem(repo: string, number: number, type: 'pr' | 'issue' = 'pr'): UnifiedInboxItem {
  return {
    type,
    number,
    title: `Item ${number}`,
    state: 'OPEN',
    url: `https://github.com/${repo}/${type === 'pr' ? 'pull' : 'issues'}/${number}`,
    repo,
    updatedAt: '2025-01-01T00:00:00Z',
    author: { login: 'dev', avatarUrl: '' },
    labels: [],
    commentCount: 0,
  }
}

function itemKey(item: UnifiedInboxItem): string {
  return `${item.repo}#${item.number}`
}

function visibleItems(items: UnifiedInboxItem[], dismissed: Set<string>): UnifiedInboxItem[] {
  return items.filter(item => !dismissed.has(itemKey(item)))
}

function highlightNext(items: UnifiedInboxItem[], currentKey: string | null): string | null {
  if (items.length === 0) return null
  if (!currentKey) return itemKey(items[0]!)
  const idx = items.findIndex(item => itemKey(item) === currentKey)
  const next = idx < items.length - 1 ? idx + 1 : 0
  return itemKey(items[next]!)
}

function highlightPrev(items: UnifiedInboxItem[], currentKey: string | null): string | null {
  if (items.length === 0) return null
  if (!currentKey) return itemKey(items[items.length - 1]!)
  const idx = items.findIndex(item => itemKey(item) === currentKey)
  const prev = idx > 0 ? idx - 1 : items.length - 1
  return itemKey(items[prev]!)
}

function dismissAndAdvance(
  items: UnifiedInboxItem[],
  dismissed: Set<string>,
  key: string,
): { dismissed: Set<string>, highlightedKey: string | null } {
  const newDismissed = new Set([...dismissed, key])
  const remaining = items.filter(item => !newDismissed.has(itemKey(item)))
  const idx = items.findIndex(item => itemKey(item) === key)

  let highlightedKey: string | null
  if (remaining.length === 0 || idx === -1) {
    highlightedKey = remaining.length > 0 ? itemKey(remaining[0]!) : null
  }
  else if (idx < remaining.length) {
    highlightedKey = itemKey(remaining[idx]!)
  }
  else {
    highlightedKey = itemKey(remaining[remaining.length - 1]!)
  }

  return { dismissed: newDismissed, highlightedKey }
}

// --- Navigation ---

describe('keyboard navigation', () => {
  const items = [
    makeItem('org/repo', 1, 'pr'),
    makeItem('org/repo', 2, 'pr'),
    makeItem('org/repo', 10, 'issue'),
    makeItem('org/repo', 11, 'issue'),
  ]

  it('highlightNext selects first item when nothing highlighted', () => {
    expect(highlightNext(items, null)).toBe('org/repo#1')
  })

  it('highlightNext advances through items', () => {
    expect(highlightNext(items, 'org/repo#1')).toBe('org/repo#2')
    expect(highlightNext(items, 'org/repo#2')).toBe('org/repo#10')
    expect(highlightNext(items, 'org/repo#10')).toBe('org/repo#11')
  })

  it('highlightNext wraps to first item', () => {
    expect(highlightNext(items, 'org/repo#11')).toBe('org/repo#1')
  })

  it('highlightPrev selects last item when nothing highlighted', () => {
    expect(highlightPrev(items, null)).toBe('org/repo#11')
  })

  it('highlightPrev goes backwards', () => {
    expect(highlightPrev(items, 'org/repo#11')).toBe('org/repo#10')
    expect(highlightPrev(items, 'org/repo#10')).toBe('org/repo#2')
  })

  it('highlightPrev wraps to last item', () => {
    expect(highlightPrev(items, 'org/repo#1')).toBe('org/repo#11')
  })

  it('returns null for empty items', () => {
    expect(highlightNext([], null)).toBeNull()
    expect(highlightPrev([], null)).toBeNull()
  })
})

// --- Dismiss ---

describe('dismiss and restore', () => {
  const items = [
    makeItem('org/repo', 1, 'pr'),
    makeItem('org/repo', 2, 'pr'),
    makeItem('org/repo', 3, 'pr'),
  ]

  it('visibleItems filters out dismissed keys', () => {
    const dismissed = new Set(['org/repo#2'])
    const visible = visibleItems(items, dismissed)
    expect(visible.map(i => i.number)).toEqual([1, 3])
  })

  it('visibleItems returns all when nothing dismissed', () => {
    const visible = visibleItems(items, new Set())
    expect(visible).toHaveLength(3)
  })

  it('dismiss advances highlight to next item', () => {
    const result = dismissAndAdvance(items, new Set(), 'org/repo#1')
    expect(result.dismissed.has('org/repo#1')).toBe(true)
    expect(result.highlightedKey).toBe('org/repo#2')
  })

  it('dismiss last item highlights previous', () => {
    const result = dismissAndAdvance(items, new Set(), 'org/repo#3')
    expect(result.highlightedKey).toBe('org/repo#2')
  })

  it('dismiss middle item highlights next', () => {
    const result = dismissAndAdvance(items, new Set(), 'org/repo#2')
    expect(result.highlightedKey).toBe('org/repo#3')
  })

  it('dismissing all items sets highlight to null', () => {
    const dismissed = new Set(['org/repo#1', 'org/repo#2'])
    const result = dismissAndAdvance(items, dismissed, 'org/repo#3')
    expect(result.highlightedKey).toBeNull()
  })

  it('dismiss with unknown key falls back to first remaining item', () => {
    const result = dismissAndAdvance(items, new Set(), 'org/other#999')
    expect(result.highlightedKey).toBe('org/repo#1')
  })

  it('restore removes key from dismissed set', () => {
    const dismissed = new Set(['org/repo#1', 'org/repo#2'])
    const next = new Set(dismissed)
    next.delete('org/repo#1')
    expect(next.has('org/repo#1')).toBe(false)
    expect(next.has('org/repo#2')).toBe(true)
  })
})

// --- Batch selection ---

function toggleSelect(selected: Set<string>, key: string): Set<string> {
  const next = new Set(selected)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

function dismissSelected(dismissed: Set<string>, selected: Set<string>): { dismissed: Set<string>, selected: Set<string> } {
  return {
    dismissed: new Set([...dismissed, ...selected]),
    selected: new Set(),
  }
}

function restoreSelected(dismissed: Set<string>, selected: Set<string>): { dismissed: Set<string>, selected: Set<string> } {
  const next = new Set(dismissed)
  for (const key of selected) next.delete(key)
  return { dismissed: next, selected: new Set() }
}

describe('batch selection', () => {
  it('toggleSelect adds key to empty set', () => {
    const result = toggleSelect(new Set(), 'org/repo#1')
    expect(result.has('org/repo#1')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('toggleSelect removes existing key', () => {
    const result = toggleSelect(new Set(['org/repo#1']), 'org/repo#1')
    expect(result.has('org/repo#1')).toBe(false)
    expect(result.size).toBe(0)
  })

  it('toggleSelect accumulates multiple keys', () => {
    let selected = new Set<string>()
    selected = toggleSelect(selected, 'org/repo#1')
    selected = toggleSelect(selected, 'org/repo#2')
    expect(selected.size).toBe(2)
    expect(selected.has('org/repo#1')).toBe(true)
    expect(selected.has('org/repo#2')).toBe(true)
  })

  it('dismissSelected moves all selected keys to dismissed and clears selection', () => {
    const selected = new Set(['org/repo#1', 'org/repo#3'])
    const dismissed = new Set(['org/repo#2'])
    const result = dismissSelected(dismissed, selected)
    expect(result.dismissed.has('org/repo#1')).toBe(true)
    expect(result.dismissed.has('org/repo#2')).toBe(true)
    expect(result.dismissed.has('org/repo#3')).toBe(true)
    expect(result.selected.size).toBe(0)
  })

  it('restoreSelected removes selected keys from dismissed and clears selection', () => {
    const dismissed = new Set(['org/repo#1', 'org/repo#2', 'org/repo#3'])
    const selected = new Set(['org/repo#1', 'org/repo#3'])
    const result = restoreSelected(dismissed, selected)
    expect(result.dismissed.has('org/repo#1')).toBe(false)
    expect(result.dismissed.has('org/repo#2')).toBe(true)
    expect(result.dismissed.has('org/repo#3')).toBe(false)
    expect(result.selected.size).toBe(0)
  })
})
