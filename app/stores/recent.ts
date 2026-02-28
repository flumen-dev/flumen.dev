import type { RecentItem, RecentItemType, RecentSyncResult } from '~~/shared/types/recent'

const MAX_ITEMS = 30

export const useRecentStore = defineStore('recent', () => {
  const items = ref<RecentItem[]>([])
  const favorites = ref<RecentItem[]>([])

  /** Find an item across both lists */
  function findItem(key: string): RecentItem | undefined {
    return favorites.value.find(i => i.key === key)
      ?? items.value.find(i => i.key === key)
  }

  /** Whether an item has unseen changes */
  function hasUpdate(item: RecentItem): boolean {
    return item.updatedAt > item.visitedAt
  }

  /**
   * Track a visited item. Sets visitedAt to now and clears previousTitle.
   * Does NOT touch updatedAt — that's the server's source of truth via sync.
   * If already present (in either list), updates in place.
   * Otherwise prepends to recent, evicting oldest if at capacity.
   */
  function track(input: {
    type: RecentItemType
    repo: string
    number: number
    title: string
    url: string
    meta?: Record<string, unknown>
  }) {
    const key = `${input.type}:${input.repo}#${input.number}`
    const now = Date.now()

    // Check favorites first — update in place, don't move
    const favIdx = favorites.value.findIndex(i => i.key === key)
    if (favIdx !== -1) {
      const item = favorites.value[favIdx]!
      item.title = input.title
      item.visitedAt = now
      delete item.previousTitle
      if (input.meta) item.meta = { ...item.meta, ...input.meta }
      favorites.value = [...favorites.value]
      return
    }

    // Check recent
    const recentIdx = items.value.findIndex(i => i.key === key)
    if (recentIdx !== -1) {
      const [item] = items.value.splice(recentIdx, 1)
      item!.title = input.title
      item!.visitedAt = now
      delete item!.previousTitle
      if (input.meta) item!.meta = { ...item!.meta, ...input.meta }
      items.value = [item!, ...items.value]
    }
    else {
      const list = items.value.length >= MAX_ITEMS
        ? items.value.slice(0, MAX_ITEMS - 1)
        : [...items.value]
      items.value = [{ key, ...input, visitedAt: now, updatedAt: now }, ...list]
    }
  }

  /**
   * Apply sync results from the server.
   * Updates updatedAt (server is source of truth), detects title renames.
   */
  function applySync(results: RecentSyncResult[]) {
    let favsChanged = false
    let itemsChanged = false

    for (const result of results) {
      const item = findItem(result.key)
      if (!item) continue

      const isFav = favorites.value.includes(item)
      const remoteUpdatedAt = new Date(result.updatedAt).getTime()

      let changed = false

      // Title rename detection
      if (result.title !== item.title) {
        item.previousTitle = item.title
        item.title = result.title
        changed = true
      }

      // Always use server's updatedAt as source of truth
      if (remoteUpdatedAt !== item.updatedAt) {
        item.updatedAt = remoteUpdatedAt
        changed = true
      }

      if (changed) {
        if (isFav) favsChanged = true
        else itemsChanged = true
      }
    }

    if (favsChanged) favorites.value = [...favorites.value]
    if (itemsChanged) items.value = [...items.value]
  }

  /**
   * Mark an item as seen — clears previousTitle and updates visitedAt.
   * Called when the user visits/opens the item.
   */
  function markSeen(key: string) {
    const item = findItem(key)
    if (!item) return

    item.visitedAt = Date.now()
    delete item.previousTitle

    if (favorites.value.includes(item)) {
      favorites.value = [...favorites.value]
    }
    else {
      items.value = [...items.value]
    }
  }

  /** Move item from recent to favorites */
  function addFavorite(key: string) {
    const idx = items.value.findIndex(i => i.key === key)
    if (idx === -1) return
    const [item] = items.value.splice(idx, 1)
    favorites.value = [...favorites.value, item!]
    items.value = [...items.value]
  }

  /** Move item from favorites back to recent (prepends, evicts oldest if full) */
  function removeFavorite(key: string) {
    const idx = favorites.value.findIndex(i => i.key === key)
    if (idx === -1) return
    const [item] = favorites.value.splice(idx, 1)
    favorites.value = [...favorites.value]
    const list = items.value.length >= MAX_ITEMS
      ? items.value.slice(0, MAX_ITEMS - 1)
      : [...items.value]
    items.value = [item!, ...list]
  }

  function remove(key: string) {
    favorites.value = favorites.value.filter(i => i.key !== key)
    items.value = items.value.filter(i => i.key !== key)
  }

  /** Reorder within recent list */
  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const list = [...items.value]
    const [item] = list.splice(fromIndex, 1)
    if (!item) return
    list.splice(toIndex, 0, item)
    items.value = list
  }

  /** Reorder within favorites list */
  function moveFavorite(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const list = [...favorites.value]
    const [item] = list.splice(fromIndex, 1)
    if (!item) return
    list.splice(toIndex, 0, item)
    favorites.value = list
  }

  /** Clear recent only, favorites stay */
  function clear() {
    items.value = []
  }

  return {
    items,
    favorites,
    hasUpdate,
    track,
    applySync,
    markSeen,
    addFavorite,
    removeFavorite,
    remove,
    moveItem,
    moveFavorite,
    clear,
  }
}, {
  persist: {
    pick: ['items', 'favorites'],
  },
})
