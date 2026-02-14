<script setup lang="ts">
interface SearchRepo {
  id: number
  fullName: string
  name: string
  owner: string
  description: string | null
  language: string | null
  visibility: string
  openIssues: number
  stars: number
}

const { t } = useI18n()
const repoStore = useRepositoryStore()
const issueStore = useIssueStore()
const { settings, update } = useUserSettings()
const apiFetch = useRequestFetch()

const open = ref(false)
const query = ref('')
const searchResults = ref<SearchRepo[]>([])
const searching = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const reposWithCounts = computed(() =>
  repoStore.repos
    .filter(r => !r.archived)
    .map(r => ({
      ...r,
      openIssues: repoStore.issueCounts[r.fullName] ?? 0,
      openPrs: repoStore.prCounts[r.fullName] ?? 0,
    }))
    .sort((a, b) => b.openIssues - a.openIssues),
)

// Filter own repos by search query
const filteredOwnRepos = computed(() => {
  if (!query.value) return reposWithCounts.value
  const q = query.value.toLowerCase()
  return reposWithCounts.value.filter(r =>
    r.fullName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
  )
})

// Exclude own repos from GitHub search results
const filteredSearchResults = computed(() => {
  const ownNames = new Set(reposWithCounts.value.map(r => r.fullName))
  return searchResults.value.filter(r => !ownNames.has(r.fullName))
})

const selectedRepoData = computed(() =>
  reposWithCounts.value.find(r => r.fullName === issueStore.selectedRepo),
)

const isExternalRepo = computed(() =>
  issueStore.selectedRepo && !reposWithCounts.value.some(r => r.fullName === issueStore.selectedRepo),
)

// Debounced GitHub search
watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!q || q.length < 2) {
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  debounceTimer = setTimeout(async () => {
    try {
      searchResults.value = await apiFetch<SearchRepo[]>('/api/repository/search', {
        params: { q },
      })
    }
    catch {
      searchResults.value = []
    }
    finally {
      searching.value = false
    }
  }, 300)
})

async function select(fullName: string) {
  open.value = false
  query.value = ''
  searchResults.value = []
  await issueStore.selectRepo(fullName)
  update({ selectedRepo: fullName })
}

// Reset search when popover closes
watch(open, (isOpen) => {
  if (!isOpen) {
    query.value = ''
    searchResults.value = []
  }
})

// Restore from settings on mount
onMounted(async () => {
  await repoStore.fetchAll()
  const saved = settings.value?.selectedRepo
  if (saved) {
    await issueStore.selectRepo(saved)
  }
})
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'bottom', align: 'start' }"
  >
    <UButton
      variant="outline"
      color="neutral"
      class="w-full justify-between"
      trailing-icon="i-lucide-chevrons-up-down"
    >
      <template v-if="selectedRepoData">
        <div class="truncate flex justify-center font-medium">
          <span>{{ selectedRepoData.name }}</span>

          <UBadge
            v-if="selectedRepoData.openIssues"
            color="error"
            variant="subtle"
            size="xs"
            class="ml-2 gap-1"
          >
            <UIcon
              name="i-lucide-circle-dot"
              class="size-3"
            />
            {{ selectedRepoData.openIssues }}
          </UBadge>
        </div>
      </template>
      <template v-else-if="isExternalRepo">
        <div class="truncate flex items-center gap-1.5 font-medium">
          <UIcon
            name="i-lucide-globe"
            class="size-3.5 text-muted shrink-0"
          />
          <span>{{ issueStore.selectedRepo }}</span>
        </div>
      </template>
      <span
        v-else
        class="text-muted"
      >{{ t('issues.selectRepo') }}</span>
    </UButton>

    <template #content>
      <div class="w-96 max-h-96 flex flex-col">
        <!-- Search input -->
        <div class="mx-2 mt-2 mb-1.5 flex items-center gap-2 px-3 py-2 rounded-md border border-default bg-default focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all">
          <UIcon
            name="i-lucide-search"
            class="size-4 text-muted shrink-0"
          />
          <input
            v-model="query"
            :placeholder="t('issues.searchRepos')"
            class="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-muted"
          >
          <UIcon
            v-if="searching"
            name="i-lucide-loader"
            class="size-4 text-muted shrink-0 animate-spin"
          />
        </div>

        <!-- Hint -->
        <p
          v-if="!query"
          class="px-3 pb-1.5 text-xs text-dimmed"
        >
          {{ t('issues.searchReposHint') }}
        </p>

        <USeparator />

        <!-- Results -->
        <div class="overflow-y-auto flex-1">
          <!-- Own repos -->
          <div v-if="filteredOwnRepos.length">
            <p
              v-if="query"
              class="px-3 pt-2 pb-1 text-xs font-semibold text-dimmed uppercase tracking-wide"
            >
              {{ t('issues.yourRepos') }}
            </p>
            <button
              v-for="repo in filteredOwnRepos"
              :key="repo.id"
              class="w-full text-left px-3 py-2.5 hover:bg-elevated transition-colors flex items-start gap-3 cursor-pointer"
              :class="{ 'bg-elevated/50': repo.fullName === issueStore.selectedRepo }"
              @click="select(repo.fullName)"
            >
              <UIcon
                :name="repo.fullName === issueStore.selectedRepo ? 'i-lucide-check' : 'i-lucide-book-marked'"
                class="size-4 mt-0.5 shrink-0"
                :class="repo.fullName === issueStore.selectedRepo ? 'text-primary' : 'text-muted'"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ repo.name }}</span>
                  <UBadge
                    v-if="repo.visibility === 'private'"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >
                    {{ t('repos.badge.private') }}
                  </UBadge>
                </div>
                <p
                  v-if="repo.description"
                  class="text-xs text-muted truncate mt-0.5"
                >
                  {{ repo.description }}
                </p>
                <div class="flex items-center gap-3 mt-1">
                  <span
                    v-if="repo.openIssues"
                    class="inline-flex items-center gap-1 text-xs text-rose-500"
                  >
                    <UIcon
                      name="i-lucide-circle-dot"
                      class="size-3.5"
                    />
                    {{ t('issues.openCount', { count: repo.openIssues }) }}
                  </span>
                  <span
                    v-if="repo.openPrs"
                    class="inline-flex items-center gap-1 text-xs text-blue-500"
                  >
                    <UIcon
                      name="i-lucide-git-pull-request"
                      class="size-3.5"
                    />
                    {{ repo.openPrs }}
                  </span>
                  <span
                    v-if="repo.language"
                    class="text-xs text-dimmed"
                  >
                    {{ repo.language }}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <!-- GitHub search results -->
          <div v-if="filteredSearchResults.length">
            <p class="px-3 pt-2 pb-1 text-xs font-semibold text-dimmed uppercase tracking-wide border-t border-default">
              GitHub
            </p>
            <button
              v-for="repo in filteredSearchResults"
              :key="repo.id"
              class="w-full text-left px-3 py-2.5 hover:bg-elevated transition-colors flex items-start gap-3 cursor-pointer"
              :class="{ 'bg-elevated/50': repo.fullName === issueStore.selectedRepo }"
              @click="select(repo.fullName)"
            >
              <UIcon
                :name="repo.fullName === issueStore.selectedRepo ? 'i-lucide-check' : 'i-lucide-globe'"
                class="size-4 mt-0.5 shrink-0"
                :class="repo.fullName === issueStore.selectedRepo ? 'text-primary' : 'text-muted'"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ repo.fullName }}</span>
                  <span class="inline-flex items-center gap-0.5 text-xs text-dimmed">
                    <UIcon
                      name="i-lucide-star"
                      class="size-3"
                    />
                    {{ repo.stars }}
                  </span>
                </div>
                <p
                  v-if="repo.description"
                  class="text-xs text-muted truncate mt-0.5"
                >
                  {{ repo.description }}
                </p>
                <div class="flex items-center gap-3 mt-1">
                  <span
                    v-if="repo.openIssues"
                    class="inline-flex items-center gap-1 text-xs text-muted"
                  >
                    <UIcon
                      name="i-lucide-activity"
                      class="size-3.5"
                    />
                    {{ repo.openIssues }}
                  </span>
                  <span
                    v-if="repo.language"
                    class="text-xs text-dimmed"
                  >
                    {{ repo.language }}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <!-- Empty state -->
          <p
            v-if="!filteredOwnRepos.length && !filteredSearchResults.length && !searching"
            class="px-3 py-4 text-sm text-muted text-center"
          >
            {{ t('repos.noResults') }}
          </p>

          <!-- Searching indicator -->
          <p
            v-if="searching && !filteredSearchResults.length"
            class="px-3 py-4 text-sm text-muted text-center"
          >
            {{ t('common.loading') }}
          </p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
