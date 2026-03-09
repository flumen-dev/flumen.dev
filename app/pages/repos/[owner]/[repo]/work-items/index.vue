<script setup lang="ts">
import type { WorkItem } from '~~/shared/types/work-item'

definePageMeta({
  middleware: 'auth',
  titleKey: 'repos.detail.workItems',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
const state = ref<'open' | 'closed' | 'all'>('open')
const search = ref('')
const sortKey = ref<'newest' | 'oldest' | 'mostCommented' | 'leastCommented' | 'recentlyUpdated'>('newest')
const activeFilters = ref<string[]>([])

const repoFullName = computed(() => `${owner.value}/${repo.value}`)

const { data: workItems, status, error: fetchError, refresh } = useLazyFetch<WorkItem[]>(
  () => `/api/repository/${owner.value}/${repo.value}/work-items`,
  {
    query: { state },
  },
)

const filteredItems = computed(() => {
  let items = workItems.value ?? []

  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    items = items.filter(item =>
      item.title.toLowerCase().includes(q)
      || `#${item.number}`.includes(q)
      || item.author.login.toLowerCase().includes(q),
    )
  }

  if (activeFilters.value.length) {
    const labelFilters = activeFilters.value.filter(f => f.startsWith('label:')).map(f => f.slice(6))
    if (labelFilters.length) {
      items = items.filter(item => labelFilters.every(lf => item.labels.some(l => l.name === lf)))
    }
    if (activeFilters.value.includes('type:issue')) {
      items = items.filter(item => item.type === 'issue')
    }
    if (activeFilters.value.includes('type:pull')) {
      items = items.filter(item => item.type === 'pull' || item.linkedPulls.length > 0)
    }
  }

  const s = sortKey.value
  return [...items].sort((a, b) => {
    if (s === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (s === 'mostCommented') return b.commentCount - a.commentCount
    if (s === 'leastCommented') return a.commentCount - b.commentCount
    if (s === 'recentlyUpdated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() // newest
  })
})

const availableLabels = computed(() => {
  const items = workItems.value ?? []
  if (!items.length) return []
  const set = new Set(items.flatMap(item => item.labels.map(l => l.name)))
  return [...set].sort()
})

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
      <RepoStateFilterButtons
        v-model="state"
        :all-label="t('workItems.filter.all')"
      />

      <!-- Toolbar: search + filters + sort -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <UInput
            v-model="search"
            :placeholder="t('workItems.search')"
            icon="i-lucide-search"
            class="flex-1"
          />
          <span class="text-sm text-muted shrink-0">
            {{ t('workItems.count', filteredItems.length) }}
          </span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
            :class="activeFilters.includes('type:issue')
              ? 'bg-primary text-inverted'
              : 'bg-muted text-toned hover:bg-accented'"
            @click="toggleFilter('type:issue')"
          >
            <UIcon
              name="i-lucide-circle-dot"
              class="size-3.5"
            />
            {{ t('nav.issues') }}
          </button>
          <button
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
            :class="activeFilters.includes('type:pull')
              ? 'bg-primary text-inverted'
              : 'bg-muted text-toned hover:bg-accented'"
            @click="toggleFilter('type:pull')"
          >
            <UIcon
              name="i-lucide-git-pull-request"
              class="size-3.5"
            />
            {{ t('nav.pullRequests') }}
          </button>
          <div class="ml-auto">
            <USelect
              v-model="sortKey"
              :items="sortOptions"
              size="xs"
            />
          </div>
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
        v-if="status === 'pending'"
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
        v-else-if="filteredItems.length"
        class="rounded-md border border-default bg-default overflow-hidden"
      >
        <div
          v-for="item in filteredItems"
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
    </template>
  </div>
</template>
