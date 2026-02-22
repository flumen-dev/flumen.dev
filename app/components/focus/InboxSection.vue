<script setup lang="ts">
const { t } = useI18n()
const store = useFocusStore()

// Mark inbox as seen after data loads (delayed so user sees "new" state first)
let seenTimer: ReturnType<typeof setTimeout> | undefined
watch(() => store.inbox.fetchedAt, (fetchedAt) => {
  clearTimeout(seenTimer)
  if (fetchedAt && store.expanded === 'inbox') {
    seenTimer = setTimeout(() => {
      if (store.expanded === 'inbox') store.markInboxSeen()
    }, 3000)
  }
})

// Inbox filter: active vs dismissed
const inboxFilter = ref<'active' | 'dismissed'>('active')

// Per-category filter state
const reviewSearch = ref('')
const reviewRepos = ref<string[]>([])
const assignedSearch = ref('')
const assignedRepos = ref<string[]>([])
const mentionsSearch = ref('')
const mentionsRepos = ref<string[]>([])

// Debounced filter calls to store
let reviewDebounce: ReturnType<typeof setTimeout> | undefined
let assignedDebounce: ReturnType<typeof setTimeout> | undefined
let mentionsDebounce: ReturnType<typeof setTimeout> | undefined

onBeforeUnmount(() => {
  clearTimeout(seenTimer)
  clearTimeout(reviewDebounce)
  clearTimeout(assignedDebounce)
  clearTimeout(mentionsDebounce)
})

watch([reviewSearch, reviewRepos], ([search, repos]) => {
  clearTimeout(reviewDebounce)
  if (!search && repos.length === 0) {
    store.filterInbox('reviewRequests', '', [])
    return
  }
  reviewDebounce = setTimeout(() => store.filterInbox('reviewRequests', search, repos), 400)
})
watch([assignedSearch, assignedRepos], ([search, repos]) => {
  clearTimeout(assignedDebounce)
  if (!search && repos.length === 0) {
    store.filterInbox('assigned', '', [])
    return
  }
  assignedDebounce = setTimeout(() => store.filterInbox('assigned', search, repos), 400)
})
watch([mentionsSearch, mentionsRepos], ([search, repos]) => {
  clearTimeout(mentionsDebounce)
  if (!search && repos.length === 0) {
    store.filterInbox('mentions', '', [])
    return
  }
  mentionsDebounce = setTimeout(() => store.filterInbox('mentions', search, repos), 400)
})

const inboxReviewItems = computed(() =>
  store.inboxReviewRequests.data.filter(i => inboxFilter.value === 'active' ? !i.isDismissed : i.isDismissed),
)
const inboxAssignedItems = computed(() =>
  store.inboxAssigned.data.filter(i => inboxFilter.value === 'active' ? !i.isDismissed : i.isDismissed),
)
const inboxMentionItems = computed(() =>
  store.inboxMentions.data.filter(i => inboxFilter.value === 'active' ? !i.isDismissed : i.isDismissed),
)

// Capture repos from initial load (before any filter changes them)
const reviewAvailableRepos = ref<string[]>([])
const assignedAvailableRepos = ref<string[]>([])
const mentionsAvailableRepos = ref<string[]>([])

watch(() => store.inbox.fetchedAt, () => {
  if (!store.inbox.fetchedAt) return
  reviewAvailableRepos.value = [...new Set(store.inboxReviewRequests.data.map(i => i.repo))].sort()
  assignedAvailableRepos.value = [...new Set(store.inboxAssigned.data.map(i => i.repo))].sort()
  mentionsAvailableRepos.value = [...new Set(store.inboxMentions.data.map(i => i.repo))].sort()
}, { immediate: true })

// Show category section if it has items OR a filter is active (so user can clear filter)
const showReviewSection = computed(() =>
  inboxReviewItems.value.length > 0 || reviewSearch.value || reviewRepos.value.length > 0 || (inboxFilter.value === 'active' && inboxReviewCount.value),
)
const showAssignedSection = computed(() =>
  inboxAssignedItems.value.length > 0 || assignedSearch.value || assignedRepos.value.length > 0 || (inboxFilter.value === 'active' && inboxAssignedCount.value),
)
const showMentionsSection = computed(() =>
  inboxMentionItems.value.length > 0 || mentionsSearch.value || mentionsRepos.value.length > 0 || (inboxFilter.value === 'active' && inboxMentionsCount.value),
)

// Deduplicated counts across all categories
const inboxActiveCount = computed(() => {
  const all = [...store.inboxReviewRequests.data, ...store.inboxAssigned.data, ...store.inboxMentions.data]
  const seen = new Set<string>()
  for (const item of all) {
    if (!item.isDismissed) seen.add(`${item.repo}#${item.number}`)
  }
  return seen.size
})

const inboxDismissedCount = computed(() => {
  const all = [...store.inboxReviewRequests.data, ...store.inboxAssigned.data, ...store.inboxMentions.data]
  const seen = new Set<string>()
  for (const item of all) {
    if (item.isDismissed) seen.add(`${item.repo}#${item.number}`)
  }
  return seen.size
})

const inboxVisibleCount = computed(() =>
  inboxReviewItems.value.length + inboxAssignedItems.value.length + inboxMentionItems.value.length,
)

// Per-category counts: loaded items or fallback to counts endpoint
const inboxReviewCount = computed(() => {
  if (store.inboxReviewRequests.fetchedAt) return inboxReviewItems.value.length
  return store.counts?.inboxReviewRequests ?? null
})
const inboxAssignedCount = computed(() => {
  if (store.inboxAssigned.fetchedAt) return inboxAssignedItems.value.length
  return store.counts?.inboxAssigned ?? null
})
const inboxMentionsCount = computed(() => {
  if (store.inboxMentions.fetchedAt) return inboxMentionItems.value.length
  return store.counts?.inboxMentions ?? null
})

// Collect all new items across inbox categories
const inboxNewItems = computed(() => {
  const items = [
    ...store.inboxReviewRequests.data.map(i => ({ ...i, _category: 'reviewRequests' as const })),
    ...store.inboxAssigned.data.map(i => ({ ...i, _category: 'assigned' as const })),
    ...store.inboxMentions.data.map(i => ({ ...i, _category: 'mentions' as const })),
  ]
  return items.filter(i => i.isNew && !i.isDismissed).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
})

function handleDismiss(repo: string, number: number) {
  store.dismissInboxItem(repo, number)
}

function handleRestore(repo: string, number: number) {
  store.restoreInboxItem(repo, number)
}

const hoveredKey = ref<string | null>(null)

// Exposed for parent (header filter chips + new indicator)
defineExpose({
  inboxFilter,
  inboxActiveCount,
  inboxDismissedCount,
})
</script>

<template>
  <div
    v-if="store.inbox.loading && !store.inbox.fetchedAt"
    class="p-6 text-center"
  >
    <UIcon
      name="i-lucide-loader-2"
      class="size-6 text-dimmed mx-auto mb-2 animate-spin"
    />
    <p class="text-sm text-muted">
      {{ t('common.loading') }}
    </p>
  </div>

  <div v-else>
    <!-- New items block (only in active tab) -->
    <template v-if="inboxFilter === 'active' && inboxNewItems.length > 0">
      <div class="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-2">
        <span class="relative flex size-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span class="relative inline-flex rounded-full size-2 bg-primary" />
        </span>
        <h3 class="text-xs font-semibold text-primary uppercase tracking-wider">
          {{ t('focus.inbox.new', { count: inboxNewItems.length }) }}
        </h3>
      </div>
      <FocusInboxItemCard
        v-for="item in inboxNewItems"
        :key="`new-${item.repo}#${item.number}`"
        :item="item"
        :category="item._category"
        :highlighted-key="hoveredKey"
        @dismiss="handleDismiss"
        @hover="hoveredKey = $event"
      />
    </template>

    <!-- Empty state for current filter -->
    <div
      v-if="inboxVisibleCount === 0"
      class="p-6 text-center"
    >
      <UIcon
        :name="inboxFilter === 'dismissed' ? 'i-lucide-eye-off' : 'i-lucide-mail'"
        class="size-8 text-dimmed mx-auto mb-2"
      />
      <p class="text-sm text-muted">
        {{ inboxFilter === 'dismissed' ? t('focus.inbox.noDismissed') : t('focus.inbox.empty') }}
      </p>
    </div>

    <!-- Review Requests -->
    <template v-if="showReviewSection">
      <div class="px-4 py-2 bg-elevated/50 border-b border-default flex items-center justify-between">
        <h3 class="text-xs font-semibold text-dimmed uppercase tracking-wider">
          {{ t('focus.inbox.reviewRequests') }}
          <UBadge
            v-if="inboxReviewCount"
            :label="String(inboxReviewCount)"
            color="neutral"
            variant="subtle"
            size="xs"
            class="ml-1"
          />
        </h3>
      </div>
      <FocusInboxCategoryFilter
        v-model:search="reviewSearch"
        v-model:selected-repos="reviewRepos"
        :repos="reviewAvailableRepos"
      />
      <div
        class="transition-opacity duration-200"
        :class="store.inboxReviewRequests.paging ? 'opacity-50 pointer-events-none' : ''"
      >
        <FocusInboxItemCard
          v-for="item in inboxReviewItems"
          :key="`review-${item.repo}#${item.number}`"
          :item="item"
          category="reviewRequests"
          :highlighted-key="hoveredKey"
          @dismiss="inboxFilter === 'dismissed' ? handleRestore(item.repo, item.number) : handleDismiss(item.repo, item.number)"
          @hover="hoveredKey = $event"
        />
      </div>
      <UiPaginator
        v-if="store.inboxReviewRequests.totalCount > 20"
        :current-page="store.inboxReviewRequests.currentPage"
        :total-pages="store.inboxReviewRequests.totalPages"
        :has-more="store.inboxReviewRequests.hasMore"
        :has-previous="store.inboxReviewRequests.hasPrevious"
        :paging="store.inboxReviewRequests.paging"
        @next="store.inboxReviewRequests.nextPage()"
        @previous="store.inboxReviewRequests.prevPage()"
      />
    </template>

    <!-- Assigned -->
    <template v-if="showAssignedSection">
      <div class="px-4 py-2 bg-elevated/50 border-b border-default flex items-center justify-between">
        <h3 class="text-xs font-semibold text-dimmed uppercase tracking-wider">
          {{ t('focus.inbox.assigned') }}
          <UBadge
            v-if="inboxAssignedCount"
            :label="String(inboxAssignedCount)"
            color="neutral"
            variant="subtle"
            size="xs"
            class="ml-1"
          />
        </h3>
      </div>
      <FocusInboxCategoryFilter
        v-model:search="assignedSearch"
        v-model:selected-repos="assignedRepos"
        :repos="assignedAvailableRepos"
      />
      <div
        class="transition-opacity duration-200"
        :class="store.inboxAssigned.paging ? 'opacity-50 pointer-events-none' : ''"
      >
        <FocusInboxItemCard
          v-for="item in inboxAssignedItems"
          :key="`assigned-${item.repo}#${item.number}`"
          :item="item"
          category="assigned"
          :highlighted-key="hoveredKey"
          @dismiss="inboxFilter === 'dismissed' ? handleRestore(item.repo, item.number) : handleDismiss(item.repo, item.number)"
          @hover="hoveredKey = $event"
        />
      </div>
      <UiPaginator
        v-if="store.inboxAssigned.totalCount > 20"
        :current-page="store.inboxAssigned.currentPage"
        :total-pages="store.inboxAssigned.totalPages"
        :has-more="store.inboxAssigned.hasMore"
        :has-previous="store.inboxAssigned.hasPrevious"
        :paging="store.inboxAssigned.paging"
        @next="store.inboxAssigned.nextPage()"
        @previous="store.inboxAssigned.prevPage()"
      />
    </template>

    <!-- Mentions -->
    <template v-if="showMentionsSection">
      <div class="px-4 py-2 bg-elevated/50 border-b border-default flex items-center justify-between">
        <h3 class="text-xs font-semibold text-dimmed uppercase tracking-wider">
          {{ t('focus.inbox.mentions') }}
          <UBadge
            v-if="inboxMentionsCount"
            :label="String(inboxMentionsCount)"
            color="neutral"
            variant="subtle"
            size="xs"
            class="ml-1"
          />
        </h3>
      </div>
      <FocusInboxCategoryFilter
        v-model:search="mentionsSearch"
        v-model:selected-repos="mentionsRepos"
        :repos="mentionsAvailableRepos"
      />
      <div
        class="transition-opacity duration-200"
        :class="store.inboxMentions.paging ? 'opacity-50 pointer-events-none' : ''"
      >
        <FocusInboxItemCard
          v-for="item in inboxMentionItems"
          :key="`mention-${item.repo}#${item.number}`"
          :item="item"
          category="mentions"
          :highlighted-key="hoveredKey"
          @dismiss="inboxFilter === 'dismissed' ? handleRestore(item.repo, item.number) : handleDismiss(item.repo, item.number)"
          @hover="hoveredKey = $event"
        />
      </div>
      <UiPaginator
        v-if="store.inboxMentions.totalCount > 20"
        :current-page="store.inboxMentions.currentPage"
        :total-pages="store.inboxMentions.totalPages"
        :has-more="store.inboxMentions.hasMore"
        :has-previous="store.inboxMentions.hasPrevious"
        :paging="store.inboxMentions.paging"
        @next="store.inboxMentions.nextPage()"
        @previous="store.inboxMentions.prevPage()"
      />
    </template>
  </div>
</template>
