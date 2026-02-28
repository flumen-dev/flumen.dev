const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Periodically syncs tracked items (favorites + recent) with GitHub.
 * Detects title renames and updatedAt changes.
 *
 * Call once in the default layout — runs on app start, then every 5 min.
 */
export function useRecentSync() {
  const store = useRecentStore()
  const { loggedIn } = useUserSession()

  let intervalId: ReturnType<typeof setInterval> | null = null

  async function sync() {
    if (!loggedIn.value) return

    const allItems = [...store.favorites, ...store.items]
    if (allItems.length === 0) return

    const input = allItems.map(i => ({
      type: i.type,
      repo: i.repo,
      number: i.number,
    }))

    try {
      const results = await $fetch('/api/user/recent-sync', {
        method: 'POST',
        body: { items: input },
      })
      store.applySync(results)
    }
    catch (err) {
      console.warn('[recent-sync] Failed:', err)
    }
  }

  function start() {
    // Sync immediately on start
    sync()
    // Then every 5 minutes
    intervalId = setInterval(sync, SYNC_INTERVAL)
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  onMounted(start)
  onUnmounted(stop)
}
