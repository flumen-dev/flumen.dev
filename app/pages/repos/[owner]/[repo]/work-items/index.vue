<script setup lang="ts">
import type { WorkItem, WorkItemsPageResponse } from '~~/shared/types/work-item'

definePageMeta({
  middleware: 'auth',
  titleKey: 'repos.detail.workItems',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
const state = ref<'open' | 'closed' | 'all'>('open')
const search = ref('')
const sortKey = ref<'newest' | 'oldest' | 'mostCommented' | 'leastCommented' | 'recentlyUpdated'>('newest')
const activeFilters = ref<string[]>([])
const availableLabels = ref<string[]>([])
const syncStatus = ref<'idle' | 'running' | 'failed'>('idle')
const syncLastSyncedAt = ref<number | null>(null)
const syncIsPartial = ref(false)
const syncLastError = ref<string | null>(null)
const authorFilter = ref('')
const assigneeFilter = ref('')

const repoFullName = computed(() => `${owner.value}/${repo.value}`)

function applySyncState(res: WorkItemsPageResponse) {
  syncStatus.value = res.sync.status
  syncLastSyncedAt.value = res.sync.lastSyncedAt
  syncIsPartial.value = res.sync.isPartial
  syncLastError.value = res.sync.lastError
  availableLabels.value = res.availableLabels
}

const allFilters = computed(() => {
  const f = [...activeFilters.value]
  if (authorFilter.value) f.push(`author:${authorFilter.value}`)
  if (assigneeFilter.value) f.push(`assignee:${assigneeFilter.value}`)
  return f
})

const section = usePaginatedSection<WorkItem, WorkItemsPageResponse>(
  requestFetch,
  '/api/work-items',
  30,
  () => ({
    repo: repoFullName.value,
    state: state.value,
    search: search.value.trim(),
    sort: sortKey.value,
    filters: allFilters.value.join('|'),
  }),
  applySyncState,
)

const workItems = section.data
const loading = section.loading
const fetchError = section.error
const totalCount = section.totalCount
const currentPage = section.currentPage
const totalPages = section.totalPages
const hasMore = section.hasMore
const hasPrevious = section.hasPrevious
const paging = section.paging
const nextPage = section.nextPage
const prevPage = section.prevPage
const refresh = section.refresh

const syncLastText = computed(() => {
  if (!syncLastSyncedAt.value) return t('workItems.sync.never')
  return timeAgo(syncLastSyncedAt.value)
})

const syncTone = computed<'neutral' | 'info' | 'warning' | 'error'>(() => {
  if (syncStatus.value === 'failed') return 'error'
  if (syncStatus.value === 'running') return 'info'
  if (syncIsPartial.value) return 'warning'
  return 'neutral'
})

const showSyncInfo = computed(() => syncStatus.value !== 'idle' || syncIsPartial.value || !!syncLastSyncedAt.value)

const syncCompactText = computed(() => {
  if (syncStatus.value === 'failed') {
    return syncLastError.value
      ? `${t('workItems.sync.failedTitle')} - ${syncLastError.value}`
      : t('workItems.sync.failedTitle')
  }
  if (syncStatus.value === 'running') {
    return `${t('workItems.sync.runningTitle')} - ${t('workItems.sync.lastSync', { time: syncLastText.value })}`
  }
  if (syncIsPartial.value) {
    return `${t('workItems.sync.partialTitle')} - ${t('workItems.sync.lastSync', { time: syncLastText.value })}`
  }
  return `${t('workItems.sync.upToDateTitle')} - ${t('workItems.sync.lastSync', { time: syncLastText.value })}`
})

if (section.isStale()) {
  refresh()
}

watch(state, () => {
  section.resetPagination()
  refresh()
})

let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    section.resetPagination()
    refresh()
  }, 250)
})

watch([sortKey, activeFilters, authorFilter, assigneeFilter], () => {
  section.resetPagination()
  refresh()
}, { deep: true })

function toggleFilter(key: string) {
  const TYPE_FILTERS = ['type:issue', 'type:pull']
  let current = activeFilters.value
  if (current.includes(key)) {
    activeFilters.value = current.filter(f => f !== key)
  }
  else {
    if (TYPE_FILTERS.includes(key)) {
      current = current.filter(f => !TYPE_FILTERS.includes(f))
    }
    activeFilters.value = [...current, key]
  }
}

type QuickFilter = 'newest' | 'most-discussed' | 'stale' | 'needs-review' | 'my-items' | null
const quickFilter = ref<QuickFilter>(null)

function applyQuickFilter(filter: QuickFilter) {
  const wasActive = quickFilter.value === filter
  quickFilter.value = wasActive ? null : filter

  // Remove previous quick:* and involves:* filters added by quick filters
  activeFilters.value = activeFilters.value.filter(f => !f.startsWith('quick:') && !f.startsWith('involves:'))

  if (!wasActive && filter) {
    const session = useUserSession()
    const login = session.user.value?.login

    switch (filter) {
      case 'newest':
        sortKey.value = 'newest'
        break
      case 'most-discussed':
        sortKey.value = 'mostCommented'
        break
      case 'stale':
        activeFilters.value = [...activeFilters.value, 'quick:stale']
        break
      case 'needs-review':
        activeFilters.value = [...activeFilters.value, 'quick:needs-review']
        break
      case 'my-items':
        if (login) {
          activeFilters.value = [...activeFilters.value, `involves:${login}`]
        }
        break
    }
  }
}

function clearAllFilters() {
  search.value = ''
  activeFilters.value = []
  authorFilter.value = ''
  assigneeFilter.value = ''
  quickFilter.value = null
  sortKey.value = 'newest'
}

const hasActiveFilters = computed(() =>
  !!(search.value || activeFilters.value.length || authorFilter.value || assigneeFilter.value),
)

const knownAuthors = computed(() => {
  const authors = new Set(workItems.value.map(i => i.author.login))
  return [...authors].sort()
})

const sortOptions = computed(() => [
  { label: t('workItems.sort.newest'), value: 'newest' },
  { label: t('workItems.sort.oldest'), value: 'oldest' },
  { label: t('workItems.sort.mostCommented'), value: 'mostCommented' },
  { label: t('workItems.sort.leastCommented'), value: 'leastCommented' },
  { label: t('workItems.sort.recentlyUpdated'), value: 'recentlyUpdated' },
])

function navigateToItem(item: WorkItem) {
  router.push(localePath(`/repos/${owner.value}/${repo.value}/work-items/${item.number}`))
}

const { stateBadgeColor, stateBadgeLabel, prStatusLabel, ciIcon } = useWorkItemBadges()
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2">
      <NuxtLinkLocale
        :to="`/repos/${owner}/${repo}`"
        class="text-sm font-semibold text-highlighted hover:text-primary transition-colors"
      >
        {{ repoFullName }}
      </NuxtLinkLocale>
      <span class="text-sm text-muted">/</span>
      <span class="text-sm text-muted">{{ t('repos.detail.workItems') }}</span>
      <UButton
        class="ml-auto"
        :label="t('workItems.create.button')"
        icon="i-lucide-plus"
        size="sm"
        :to="localePath(`/repos/${owner}/${repo}/work-items/new`)"
      />
    </div>

    <!-- Error -->
    <div
      v-if="fetchError"
      class="space-y-3"
    >
      <UAlert
        :title="t('repos.error.fetchError.title')"
        :description="t('repos.error.fetchError.description')"
        color="error"
        icon="i-lucide-alert-triangle"
      />
      <UButton
        :label="t('common.retry')"
        icon="i-lucide-refresh-cw"
        variant="outline"
        @click="refresh()"
      />
    </div>

    <template v-else>
      <!-- State tabs -->
      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          :variant="state === 'open' ? 'solid' : 'outline'"
          icon="i-lucide-circle-dot"
          @click="state = 'open'"
        >
          {{ t('workItems.open') }}
        </UButton>
        <UButton
          size="xs"
          :variant="state === 'closed' ? 'solid' : 'outline'"
          icon="i-lucide-check-circle"
          @click="state = 'closed'"
        >
          {{ t('workItems.closed') }}
        </UButton>
        <UButton
          size="xs"
          :variant="state === 'all' ? 'solid' : 'outline'"
          @click="state = 'all'"
        >
          {{ t('workItems.filter.all') }}
        </UButton>
      </div>

      <div
        v-if="showSyncInfo"
        class="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border border-default bg-muted/30"
      >
        <UIcon
          :name="syncStatus === 'running' ? 'i-lucide-loader-circle' : syncStatus === 'failed' ? 'i-lucide-alert-triangle' : syncIsPartial ? 'i-lucide-clock-3' : 'i-lucide-check-circle-2'"
          class="size-3.5"
          :class="syncTone === 'error' ? 'text-error' : syncTone === 'warning' ? 'text-warning' : syncTone === 'info' ? 'text-info' : 'text-success'"
        />
        <span class="text-muted">{{ syncCompactText }}</span>
      </div>

      <!-- Quick filter badges -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="qf in ([
            { value: 'newest', label: t('workItems.quick.newest'), icon: 'i-lucide-sparkles' },
            { value: 'most-discussed', label: t('workItems.quick.mostDiscussed'), icon: 'i-lucide-message-circle' },
            { value: 'stale', label: t('workItems.quick.stale'), icon: 'i-lucide-clock' },
            { value: 'needs-review', label: t('workItems.quick.needsReview'), icon: 'i-lucide-eye' },
            { value: 'my-items', label: t('workItems.quick.myItems'), icon: 'i-lucide-user' },
          ] as const)"
          :key="qf.value"
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border cursor-pointer"
          :class="quickFilter === qf.value
            ? 'bg-primary text-inverted border-primary'
            : 'text-muted border-default hover:text-highlighted hover:border-primary/40'"
          @click="applyQuickFilter(qf.value)"
        >
          <UIcon
            :name="qf.icon"
            class="size-3"
          />
          {{ qf.label }}
        </button>
      </div>

      <!-- Toolbar: search + filters + sort -->
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="search"
            :placeholder="t('workItems.search.placeholder')"
            icon="i-lucide-search"
            size="sm"
            class="w-64"
          />
          <div class="inline-flex rounded-md border border-default overflow-hidden">
            <button
              v-for="opt in ([
                { value: '', label: t('workItems.search.allTypes') },
                { value: 'type:issue', label: t('workItems.type.issue') },
                { value: 'type:pull', label: t('workItems.type.pr') },
              ] as const)"
              :key="opt.value"
              class="px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
              :class="(opt.value === '' ? !activeFilters.includes('type:issue') && !activeFilters.includes('type:pull') : activeFilters.includes(opt.value))
                ? 'bg-primary text-inverted'
                : 'text-muted hover:text-highlighted hover:bg-elevated'"
              @click="opt.value ? toggleFilter(opt.value) : (activeFilters = activeFilters.filter(f => f !== 'type:issue' && f !== 'type:pull'))"
            >
              {{ opt.label }}
            </button>
          </div>
          <USelectMenu
            v-model="authorFilter"
            :items="knownAuthors"
            :placeholder="t('workItems.search.author')"
            searchable
            clear
            size="sm"
            icon="i-lucide-user"
            class="w-40"
          />
          <USelectMenu
            v-model="assigneeFilter"
            :items="knownAuthors"
            :placeholder="t('workItems.search.assignee')"
            searchable
            clear
            size="sm"
            icon="i-lucide-user-check"
            class="w-40"
          />
          <div class="ml-auto flex items-center gap-2">
            <span class="text-sm text-muted shrink-0">
              {{ t('workItems.count', totalCount) }}
            </span>
            <USelect
              v-model="sortKey"
              :items="sortOptions"
              size="xs"
            />
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <UButton
            v-if="hasActiveFilters"
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            :label="t('workItems.search.clear')"
            @click="clearAllFilters"
          />
        </div>
        <div
          v-if="availableLabels.length"
          class="flex items-center gap-1.5 flex-wrap"
        >
          <button
            v-for="label in availableLabels"
            :key="label"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer"
            :class="activeFilters.includes(`label:${label}`)
              ? 'bg-primary text-inverted'
              : 'bg-muted text-toned hover:bg-accented'"
            @click="toggleFilter(`label:${label}`)"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="loading && !workItems.length"
        class="rounded-lg border border-default divide-y divide-default overflow-hidden"
      >
        <div
          v-for="n in 6"
          :key="n"
          class="flex items-start gap-3 px-4 py-3"
        >
          <USkeleton class="size-4 mt-0.5 rounded-full shrink-0" />
          <div class="min-w-0 flex-1 space-y-2">
            <USkeleton class="h-4 w-56 rounded" />
            <USkeleton class="h-3 w-40 rounded" />
          </div>
        </div>
      </div>

      <!-- Work item list -->
      <div
        v-else-if="workItems.length"
        class="rounded-md border border-default bg-default overflow-hidden"
      >
        <div
          v-for="item in workItems"
          :key="item.id"
          role="link"
          tabindex="0"
          class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-primary hover:pl-2.5 transition-all border-b border-default last:border-b-0 cursor-pointer"
          @click="navigateToItem(item)"
          @keydown.enter="navigateToItem(item)"
          @keydown.space.prevent="navigateToItem(item)"
        >
          <RepoWorkItemRow
            :item="item"
            :repo="repoFullName"
            :state-badge-color="stateBadgeColor(item.state)"
            :state-badge-label="stateBadgeLabel(item)"
            :pr-status-label="prStatusLabel(item)"
            :ci-icon="ciIcon(item.ciStatus)"
          />
        </div>
      </div>

      <!-- Empty -->
      <p
        v-else
        class="py-8 text-center text-sm text-muted"
      >
        {{ t('repos.noResults') }}
      </p>

      <UiPaginator
        :current-page="currentPage"
        :total-pages="totalPages"
        :has-more="hasMore"
        :has-previous="hasPrevious"
        :paging="paging"
        @next="nextPage()"
        @previous="prevPage()"
      />
    </template>
  </div>
</template>
