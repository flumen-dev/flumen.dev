import type { FocusItem } from '~~/server/api/focus/working-on.get'

type SectionKey = 'workingOn' | 'watching' | 'recent'

interface SectionState<T> {
  data: T[]
  loading: boolean
  fetchedAt: number | null
  error: boolean
}

const STALE_MS = 2 * 60 * 1000 // 2 minutes

function freshSection<T>(): SectionState<T> {
  return { data: [], loading: false, fetchedAt: null, error: false }
}

export const useFocusStore = defineStore('focus', () => {
  const apiFetch = useRequestFetch()

  const expanded = ref<SectionKey | null>(null)

  // --- Section states ---
  const workingOn = ref<SectionState<FocusItem>>(freshSection())
  const watching = ref<SectionState<never>>(freshSection())
  const recent = ref<SectionState<never>>(freshSection())

  function isStale(section: SectionState<unknown>): boolean {
    if (!section.fetchedAt) return true
    return Date.now() - section.fetchedAt > STALE_MS
  }

  // --- Toggle + lazy fetch ---
  async function toggle(key: SectionKey) {
    if (expanded.value === key) {
      expanded.value = null
      return
    }
    expanded.value = key

    if (key === 'workingOn' && isStale(workingOn.value)) {
      await fetchWorkingOn()
    }
    // watching + recent: placeholder for now
  }

  async function fetchWorkingOn() {
    workingOn.value.loading = true
    workingOn.value.error = false
    try {
      const res = await apiFetch<{ items: FocusItem[] }>('/api/focus/working-on')
      workingOn.value.data = res.items
      workingOn.value.fetchedAt = Date.now()
    }
    catch {
      workingOn.value.error = true
    }
    finally {
      workingOn.value.loading = false
    }
  }

  async function refreshSection(key: SectionKey) {
    if (key === 'workingOn') {
      workingOn.value.fetchedAt = null
      await fetchWorkingOn()
    }
  }

  return {
    expanded,
    workingOn,
    watching,
    recent,
    toggle,
    refreshSection,
  }
})
