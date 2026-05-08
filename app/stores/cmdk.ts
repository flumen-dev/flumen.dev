export type CmdkResultType = 'recent' | 'repo' | 'action'

export interface CmdkResult {
  type: CmdkResultType
  id: string
  title: string
  subtitle?: string
  url?: string
  avatarUrl?: string
  iconKey?: string
  badge?: string
  onSelect?: () => void | Promise<void>
}

export interface CmdkSection {
  key: string
  label: string
  results: CmdkResult[]
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true
  return target.toLowerCase().includes(query.toLowerCase())
}

export const useCmdkStore = defineStore('cmdk', () => {
  const apiFetch = useRequestFetch()
  const localePath = useLocalePath()
  const { t } = useI18n()

  const staticActions = computed(() => [
    { id: 'action:new-issue', title: t('cmdk.actionNewIssue'), iconKey: 'i-lucide-plus', url: '/issues/new' },
    { id: 'action:settings', title: t('cmdk.actionSettings'), iconKey: 'i-lucide-settings', url: '/settings' },
  ])

  function repoSubtitle(r: CmdkRepo): string | undefined {
    if (r.isPrivate && r.isFork) return t('cmdk.subtitlePrivateFork')
    if (r.isPrivate) return t('cmdk.subtitlePrivate')
    if (r.isFork) return t('cmdk.subtitleFork')
    return undefined
  }

  // --- UI state ---
  const open = ref(false)
  const query = ref('')
  const selectedIndex = ref(0)

  // --- Data state ---
  const repos = ref<CmdkRepo[]>([])
  const recents = ref<RecentItem[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  // --- Loaders ---
  async function loadIfNeeded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const [r, rec] = await Promise.all([
        apiFetch<CmdkRepo[]>('/api/user/repos'),
        apiFetch<RecentItem[]>('/api/user/recents'),
      ])
      repos.value = r
      recents.value = rec
      loaded.value = true
    }
    finally {
      loading.value = false
    }
  }

  async function trackRecent(item: Omit<RecentItem, 'viewedAt'>) {
    const optimistic: RecentItem = { ...item, viewedAt: Date.now() }
    recents.value = [
      optimistic,
      ...recents.value.filter(r => !(r.type === item.type && r.id === item.id)),
    ].slice(0, RECENTS_CAP)
    try {
      const next = await $fetch<RecentItem[]>('/api/user/recents', {
        method: 'PUT',
        body: optimistic,
      })
      recents.value = next
    }
    catch {
      // optimistic stays; reload will resync
    }
  }

  // --- Derived results ---
  const recentResults = computed<CmdkResult[]>(() =>
    recents.value
      .filter(r => fuzzyMatch(query.value, r.title) || fuzzyMatch(query.value, r.subtitle ?? ''))
      .slice(0, 7)
      .map(r => ({
        type: 'recent',
        id: `recent:${r.type}:${r.id}`,
        title: r.title,
        subtitle: r.subtitle,
        url: r.url,
        avatarUrl: r.avatarUrl,
        iconKey: iconForRecent(r.type),
      })),
  )

  const repoResults = computed<CmdkResult[]>(() => {
    const q = query.value.trim()
    const filtered = q
      ? repos.value.filter(r => fuzzyMatch(q, r.fullName))
      : repos.value.slice(0, 5)
    return filtered.slice(0, q ? 20 : 5).map(r => ({
      type: 'repo',
      id: `repo:${r.fullName}`,
      title: r.fullName,
      subtitle: repoSubtitle(r),
      avatarUrl: r.avatarUrl,
      iconKey: 'i-lucide-folder-git-2',
      url: localePath(`/repos/${r.owner}/${r.name}`),
    }))
  })

  const actionResults = computed<CmdkResult[]>(() =>
    staticActions.value.filter(a => fuzzyMatch(query.value, a.title)).map(a => ({
      type: 'action',
      id: a.id,
      title: a.title,
      iconKey: a.iconKey,
      url: a.url ? localePath(a.url) : undefined,
    })),
  )

  const sections = computed<CmdkSection[]>(() => {
    const out: CmdkSection[] = []
    if (recentResults.value.length) {
      out.push({ key: 'recent', label: t('cmdk.sectionRecent'), results: recentResults.value })
    }
    if (repoResults.value.length) {
      out.push({ key: 'repo', label: t('cmdk.sectionRepositories'), results: repoResults.value })
    }
    if (actionResults.value.length) {
      out.push({ key: 'action', label: t('cmdk.sectionActions'), results: actionResults.value })
    }
    return out
  })

  const flatResults = computed<CmdkResult[]>(() =>
    sections.value.flatMap(s => s.results),
  )

  // Keep selection valid when results change
  watch(flatResults, (next) => {
    if (selectedIndex.value >= next.length) {
      selectedIndex.value = Math.max(0, next.length - 1)
    }
  })

  // --- Actions ---
  function openPalette() {
    open.value = true
    query.value = ''
    selectedIndex.value = 0
    loadIfNeeded()
  }

  function closePalette() {
    open.value = false
  }

  function togglePalette() {
    if (open.value) closePalette()
    else openPalette()
  }

  function setQuery(value: string) {
    query.value = value
    selectedIndex.value = 0
  }

  function selectNext() {
    if (!flatResults.value.length) return
    selectedIndex.value = (selectedIndex.value + 1) % flatResults.value.length
  }

  function selectPrev() {
    if (!flatResults.value.length) return
    selectedIndex.value = (selectedIndex.value - 1 + flatResults.value.length) % flatResults.value.length
  }

  function highlightById(id: string) {
    const idx = flatResults.value.findIndex(r => r.id === id)
    if (idx >= 0) selectedIndex.value = idx
  }

  async function executeSelected() {
    const item = flatResults.value[selectedIndex.value]
    if (!item) return
    await execute(item)
  }

  async function execute(item: CmdkResult) {
    closePalette()
    if (item.onSelect) {
      await item.onSelect()
      return
    }
    if (item.url) {
      await navigateTo(item.url)
    }
  }

  return {
    // state
    open,
    query,
    selectedIndex,
    loading,
    // derived
    sections,
    flatResults,
    // actions
    openPalette,
    closePalette,
    togglePalette,
    setQuery,
    selectNext,
    selectPrev,
    highlightById,
    executeSelected,
    execute,
    trackRecent,
    loadIfNeeded,
  }
})

function iconForRecent(type: RecentItem['type']): string {
  switch (type) {
    case 'repo': return 'i-lucide-folder-git-2'
    case 'issue': return 'i-lucide-circle-dot'
    case 'pr': return 'i-lucide-git-pull-request'
    case 'user': return 'i-lucide-user'
  }
}
