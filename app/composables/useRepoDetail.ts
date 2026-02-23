import type { RepoDetail, RepoHealthStats, RepoTreeEntry, RepoFileContent } from '~~/shared/types/repository'

interface DirectoryContents {
  type: 'directory'
  entries: RepoTreeEntry[]
}

interface FileContents {
  type: 'file'
  file: RepoFileContent
}

type ContentsResponse = DirectoryContents | FileContents

const CODE_TAB_VALUE = '__code__'
const SPECIAL_FILE_NAMES = new Set([
  'README.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'LICENSE.md',
  'SECURITY.md',
])

export function useRepoDetail(owner: Ref<string>, repo: Ref<string>) {
  const route = useRoute()
  const router = useRouter()

  const repoDetail = ref<RepoDetail | null>(null)
  const specialFiles = ref<RepoTreeEntry[]>([])
  const specialFileContent = ref('')
  const stats = ref<RepoHealthStats | null>(null)
  const currentPath = ref('')
  const directoryEntries = ref<RepoTreeEntry[]>([])
  const fileContent = ref<RepoFileContent | null>(null)
  const browsingFile = ref(false)

  const loading = ref(true)
  const error = ref<string | null>(null)

  const activeTab = ref('')

  const repoContext = computed(() => `${owner.value}/${repo.value}`)

  const isCodeTab = computed(() => activeTab.value === CODE_TAB_VALUE)
  const isViewingFile = computed(() => isCodeTab.value && browsingFile.value)

  async function fetchRepo() {
    repoDetail.value = await $fetch<RepoDetail>(`/api/repository/${owner.value}/${repo.value}`)
  }

  async function fetchStats() {
    stats.value = await $fetch<RepoHealthStats>(`/api/repository/${owner.value}/${repo.value}/stats`)
  }

  async function fetchContents(path = '') {
    currentPath.value = path
    const data = await $fetch<ContentsResponse>(`/api/repository/${owner.value}/${repo.value}/contents`, {
      params: { path },
    })
    if (data.type === 'directory') {
      browsingFile.value = false
      directoryEntries.value = data.entries
      fileContent.value = null
    }
    else {
      browsingFile.value = true
      fileContent.value = data.file
    }
  }

  async function fetchSpecialFiles() {
    if (!currentPath.value && !browsingFile.value) {
      specialFiles.value = directoryEntries.value.filter(
        entry => entry.type === 'file' && SPECIAL_FILE_NAMES.has(entry.name),
      )
      return
    }

    const data = await $fetch<ContentsResponse>(`/api/repository/${owner.value}/${repo.value}/contents`)
    if (data.type !== 'directory') {
      specialFiles.value = []
      return
    }

    specialFiles.value = data.entries.filter(
      entry => entry.type === 'file' && SPECIAL_FILE_NAMES.has(entry.name),
    )
  }

  async function fetchSpecialFileContent(path: string) {
    const data = await $fetch<ContentsResponse>(`/api/repository/${owner.value}/${repo.value}/contents`, {
      params: { path },
    })
    if (data.type === 'file') {
      specialFileContent.value = data.file.content
      return
    }
    specialFileContent.value = ''
  }

  function navigateToPath(path: string) {
    // Switch to Code tab and update URL
    activeTab.value = CODE_TAB_VALUE
    router.replace({ query: { ...route.query, path: path || undefined } })
    return fetchContents(path)
  }

  function navigateUp() {
    const parts = currentPath.value.split('/')
    parts.pop()
    const newPath = parts.join('/')
    router.replace({ query: { ...route.query, path: newPath || undefined } })
    return fetchContents(newPath)
  }

  function exitCodeBrowser() {
    // Return to first special file tab (README) or first available
    const readme = specialFiles.value.find(f => f.name.toLowerCase().startsWith('readme'))
    activeTab.value = readme?.path ?? specialFiles.value[0]?.path ?? ''
    router.replace({ query: { ...route.query, path: undefined } })
  }

  /** Initialize active tab and path from URL */
  function initFromRoute() {
    const queryPath = route.query.path as string | undefined
    if (queryPath !== undefined) {
      // URL has a path — activate Code tab and load that path
      activeTab.value = CODE_TAB_VALUE
      fetchContents(queryPath)
    }
    else {
      // Default to README if available
      const readme = specialFiles.value.find(f => f.path.toLowerCase().startsWith('readme'))
      activeTab.value = readme?.path ?? specialFiles.value[0]?.path ?? CODE_TAB_VALUE
    }
  }

  watch(activeTab, async (tab) => {
    if (!tab || tab === CODE_TAB_VALUE) return
    if (route.query.path !== undefined) {
      await router.replace({ query: { ...route.query, path: undefined } })
    }
    await fetchSpecialFileContent(tab)
  })

  watch([owner, repo], async ([nextOwner, nextRepo], [prevOwner, prevRepo]) => {
    if (nextOwner === prevOwner && nextRepo === prevRepo) return
    await loadAll()
  })

  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      const queryPath = route.query.path as string || ''
      await Promise.all([
        fetchRepo(),
        fetchStats(),
        fetchContents(queryPath),
      ])
      await fetchSpecialFiles()
      initFromRoute()
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load repository'
    }
    finally {
      loading.value = false
    }
  }

  return {
    // State
    repoDetail,
    specialFiles,
    specialFileContent,
    activeTab,
    isCodeTab,
    isViewingFile,
    stats,
    currentPath,
    directoryEntries,
    fileContent,
    browsingFile,
    loading,
    error,
    repoContext,

    // Actions
    loadAll,
    fetchContents,
    navigateToPath,
    navigateUp,
    exitCodeBrowser,
  }
}
