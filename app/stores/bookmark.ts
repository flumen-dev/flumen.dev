export const useBookmarkStore = defineStore('bookmark', () => {
  const apiFetch = useRequestFetch()
  const items = ref<Bookmark[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  async function loadIfNeeded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      items.value = await apiFetch<Bookmark[]>('/api/user/bookmarks')
      loaded.value = true
    }
    finally {
      loading.value = false
    }
  }

  function isBookmarked(id: string): boolean {
    return items.value.some(b => b.id === id)
  }

  /**
   * Toggle a bookmark. Optimistic — the server roundtrip is fire-and-forget;
   * the result is reconciled when it returns.
   */
  async function toggleBookmark(input: Omit<Bookmark, 'addedAt'>) {
    const existing = items.value.find(b => b.id === input.id)
    if (existing) {
      // Optimistic remove
      items.value = items.value.filter(b => b.id !== input.id)
      try {
        const next = await $fetch<Bookmark[]>('/api/user/bookmarks', {
          method: 'DELETE',
          query: { id: input.id },
        })
        items.value = next
      }
      catch {
        // Roll back on failure
        items.value = [existing, ...items.value]
      }
      return
    }
    // Optimistic add
    const optimistic: Bookmark = { ...input, addedAt: Date.now() }
    items.value = [optimistic, ...items.value]
    try {
      const next = await $fetch<Bookmark[]>('/api/user/bookmarks', {
        method: 'PUT',
        body: optimistic,
      })
      items.value = next
    }
    catch {
      items.value = items.value.filter(b => b.id !== input.id)
    }
  }

  const byType = computed(() => ({
    issue: items.value.filter(b => b.type === 'issue'),
    pr: items.value.filter(b => b.type === 'pr'),
    repo: items.value.filter(b => b.type === 'repo'),
  }))

  /** Direct removal by id (used from the bookmarks page). */
  async function removeBookmark(id: string) {
    const existing = items.value.find(b => b.id === id)
    if (!existing) return
    items.value = items.value.filter(b => b.id !== id)
    try {
      const next = await $fetch<Bookmark[]>('/api/user/bookmarks', {
        method: 'DELETE',
        query: { id },
      })
      items.value = next
    }
    catch {
      items.value = [existing, ...items.value]
    }
  }

  return {
    items,
    loaded,
    loading,
    byType,
    loadIfNeeded,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
  }
})
