<script setup lang="ts">
definePageMeta({
  titleKey: 'nav.focus',
  middleware: 'auth',
})

const { t } = useI18n()
const store = useFocusStore()
const localePath = useLocalePath()

// Load counts on mount (lightweight, single API call)
onMounted(() => store.fetchCounts())

const sections = [
  { key: 'workingOn' as const, icon: 'i-lucide-hammer', emptyIcon: 'i-lucide-hard-hat' },
  { key: 'inbox' as const, icon: 'i-lucide-inbox', emptyIcon: 'i-lucide-mail' },
  { key: 'created' as const, icon: 'i-lucide-pen-line', emptyIcon: 'i-lucide-file-text' },
  { key: 'watching' as const, icon: 'i-lucide-eye', emptyIcon: 'i-lucide-bookmark' },
  { key: 'recent' as const, icon: 'i-lucide-clock', emptyIcon: 'i-lucide-activity' },
] as const

type SectionKey = typeof sections[number]['key']

function sectionState(key: SectionKey) {
  return store[key]
}

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

// Mark inbox as seen after data loads (delayed so user sees "new" state first)
watch(() => store.inbox.fetchedAt, (fetchedAt) => {
  if (fetchedAt && store.expanded === 'inbox') {
    setTimeout(() => store.markInboxSeen(), 3000)
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
let reviewDebounce: ReturnType<typeof setTimeout>
let assignedDebounce: ReturnType<typeof setTimeout>
let mentionsDebounce: ReturnType<typeof setTimeout>

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

// Per-category counts: loaded items (filtered by active/dismissed) or fallback to counts endpoint
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

function handleDismiss(repo: string, number: number) {
  store.dismissInboxItem(repo, number)
}

function handleRestore(repo: string, number: number) {
  store.restoreInboxItem(repo, number)
}

const inboxHoveredKey = ref<string | null>(null)

const sectionCounts = computed(() => {
  const result: Record<SectionKey, number | null> = {
    workingOn: null,
    inbox: null,
    created: null,
    watching: null,
    recent: null,
  }

  for (const key of ['workingOn', 'inbox', 'created', 'watching', 'recent'] as SectionKey[]) {
    // Inbox has no total — category counts shown in sub-headers
    if (key === 'inbox') continue

    const state = sectionState(key)

    if (key === 'created' && state.fetchedAt) {
      result[key] = store.createdTotalCount
    }
    else if (state.fetchedAt && 'data' in state) {
      result[key] = (state.data as unknown[]).length
    }
    else if (store.counts) {
      if (key === 'workingOn') result[key] = store.counts.workingOn
      else if (key === 'created') {
        result[key] = store.createdStateFilter === 'closed'
          ? store.counts.createdClosed
          : store.counts.createdOpen
      }
    }
  }

  return result
})
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Intro -->
    <div class="flex items-center gap-3">
      <UIcon
        name="i-lucide-crosshair"
        class="size-6 text-primary shrink-0"
      />
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          {{ t('focus.title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('focus.description') }}
        </p>
      </div>
    </div>

    <section
      v-for="s in sections"
      :key="s.key"
      class="rounded-lg border border-default"
    >
      <!-- Section header -->
      <button
        class="flex w-full items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-elevated transition-colors"
        :class="{ 'rounded-lg': store.expanded !== s.key, 'rounded-t-lg': store.expanded === s.key }"
        @click="store.toggle(s.key)"
      >
        <UIcon
          :name="s.icon"
          class="size-5 text-highlighted shrink-0"
        />
        <h2 class="text-sm font-semibold text-highlighted">
          {{ t(`focus.${s.key}.title`) }}
        </h2>

        <!-- Count badge -->
        <USkeleton
          v-if="store.countsLoading && sectionCounts[s.key] == null"
          class="h-5 w-6 rounded-full"
        />
        <UBadge
          v-else-if="sectionCounts[s.key] != null && sectionCounts[s.key]! > 0"
          :label="String(sectionCounts[s.key])"
          color="neutral"
          variant="subtle"
          size="sm"
        />

        <!-- Inbox: new indicator (before expanded) -->
        <span
          v-if="s.key === 'inbox' && store.counts?.inboxHasNew && store.expanded !== 'inbox'"
          class="relative flex size-2"
        >
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span class="relative inline-flex rounded-full size-2 bg-primary" />
        </span>

        <!-- Inbox: filter chips -->
        <template v-if="s.key === 'inbox' && store.expanded === 'inbox'">
          <div
            class="flex items-center gap-1 ml-2"
            @click.stop
          >
            <UBadge
              :label="`${t('focus.inbox.active')} (${inboxActiveCount})`"
              :color="inboxFilter === 'active' ? 'primary' : 'neutral'"
              :variant="inboxFilter === 'active' ? 'solid' : 'subtle'"
              size="sm"
              class="cursor-pointer"
              @click="inboxFilter = 'active'"
            />
            <UBadge
              :label="`${t('focus.inbox.dismissed')} (${inboxDismissedCount})`"
              :color="inboxFilter === 'dismissed' ? 'primary' : 'neutral'"
              :variant="inboxFilter === 'dismissed' ? 'solid' : 'subtle'"
              size="sm"
              class="cursor-pointer"
              @click="inboxFilter = 'dismissed'"
            />
          </div>
        </template>

        <!-- Created: state filter chips (inside header, right of count) -->
        <template v-if="s.key === 'created' && store.expanded === 'created'">
          <div
            class="flex items-center gap-1 ml-2"
            @click.stop
          >
            <UBadge
              :label="t('issues.open')"
              :color="store.createdStateFilter === 'open' ? 'primary' : 'neutral'"
              :variant="store.createdStateFilter === 'open' ? 'solid' : 'subtle'"
              size="sm"
              class="cursor-pointer"
              @click="store.setCreatedFilter('open')"
            />
            <UBadge
              :label="t('issues.closed')"
              :color="store.createdStateFilter === 'closed' ? 'primary' : 'neutral'"
              :variant="store.createdStateFilter === 'closed' ? 'solid' : 'subtle'"
              size="sm"
              class="cursor-pointer"
              @click="store.setCreatedFilter('closed')"
            />
          </div>
        </template>

        <div class="ml-auto flex items-center gap-2">
          <UIcon
            v-if="sectionState(s.key).loading"
            name="i-lucide-loader-2"
            class="size-4 text-dimmed animate-spin"
          />
          <UIcon
            :name="store.expanded === s.key ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="size-4 text-dimmed"
          />
        </div>
      </button>

      <!-- Expanded content -->
      <div
        v-if="store.expanded === s.key"
        class="border-t border-default"
      >
        <!-- Working On -->
        <template v-if="s.key === 'workingOn'">
          <div
            v-if="store.workingOn.loading && !store.workingOn.data.length"
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

          <div
            v-else-if="store.workingOn.data.length === 0"
            class="p-6 text-center"
          >
            <UIcon
              name="i-lucide-hard-hat"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.workingOn.empty') }}
            </p>
          </div>

          <div v-else>
            <NuxtLink
              v-for="item in store.workingOn.data"
              :key="`${item.repo}#${item.number}`"
              :to="item.type === 'issue' ? localePath({ path: `/issues/${item.number}`, query: { repo: item.repo } }) : item.url"
              :external="item.type === 'pr'"
              :target="item.type === 'pr' ? '_blank' : undefined"
              class="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors border-b border-default last:border-b-0"
            >
              <UIcon
                :name="item.type === 'issue' ? 'i-lucide-circle-dot' : 'i-lucide-git-pull-request'"
                class="size-4 mt-0.5 shrink-0"
                :class="item.type === 'issue' ? 'text-emerald-500' : (item.isDraft ? 'text-neutral-400' : 'text-blue-500')"
              />

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-highlighted truncate">
                    {{ item.title }}
                  </span>
                  <span class="text-xs text-dimmed shrink-0">
                    #{{ item.number }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-muted">
                    {{ item.repo }}
                  </span>
                  <UBadge
                    v-if="item.isDraft"
                    :label="$t('repos.badge.draft')"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  />
                  <UBadge
                    v-for="label in item.labels.slice(0, 3)"
                    :key="label.name"
                    :label="label.name"
                    :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
                    variant="subtle"
                    size="xs"
                  />
                </div>
              </div>

              <UBadge
                v-if="item.branchName"
                :label="item.branchName"
                color="neutral"
                variant="outline"
                size="xs"
                class="shrink-0 max-w-40 truncate"
              />
            </NuxtLink>
          </div>
        </template>

        <!-- Inbox -->
        <template v-else-if="s.key === 'inbox'">
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
                :highlighted-key="inboxHoveredKey"
                @dismiss="handleDismiss"
                @hover="inboxHoveredKey = $event"
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
                {{ t(inboxFilter === 'dismissed' ? 'focus.inbox.noDismissed' : 'focus.inbox.empty') }}
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
                  :highlighted-key="inboxHoveredKey"
                  @dismiss="inboxFilter === 'dismissed' ? handleRestore(item.repo, item.number) : handleDismiss(item.repo, item.number)"
                  @hover="inboxHoveredKey = $event"
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
                  :highlighted-key="inboxHoveredKey"
                  @dismiss="inboxFilter === 'dismissed' ? handleRestore(item.repo, item.number) : handleDismiss(item.repo, item.number)"
                  @hover="inboxHoveredKey = $event"
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
                  :highlighted-key="inboxHoveredKey"
                  @dismiss="inboxFilter === 'dismissed' ? handleRestore(item.repo, item.number) : handleDismiss(item.repo, item.number)"
                  @hover="inboxHoveredKey = $event"
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

        <!-- Created -->
        <template v-else-if="s.key === 'created'">
          <!-- Skeleton loading -->
          <div v-if="store.created.loading && !store.created.data.length">
            <FocusCardSkeleton
              v-for="i in 10"
              :key="i"
            />
          </div>

          <!-- Empty state -->
          <div
            v-else-if="store.created.data.length === 0"
            class="p-6 text-center"
          >
            <UIcon
              name="i-lucide-file-text"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.created.empty') }}
            </p>
          </div>

          <!-- Items + pagination -->
          <div v-else>
            <div
              class="transition-opacity duration-200"
              :class="store.createdPaging ? 'opacity-50 pointer-events-none' : ''"
            >
              <FocusCreatedIssueCard
                v-for="item in store.created.data"
                :key="item.id"
                :item="item"
              />
            </div>

            <UiPaginator
              :current-page="store.createdPage"
              :total-pages="store.createdTotalPages"
              :has-more="store.createdHasMore"
              :has-previous="store.createdHasPrevious"
              :paging="store.createdPaging"
              @next="store.createdNextPage()"
              @previous="store.createdPrevPage()"
            />
          </div>
        </template>

        <!-- Watching: placeholder -->
        <template v-else-if="s.key === 'watching'">
          <div class="p-6 text-center">
            <UIcon
              name="i-lucide-bookmark"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.watching.empty') }}
            </p>
          </div>
        </template>

        <!-- Recent: placeholder -->
        <template v-else>
          <div class="p-6 text-center">
            <UIcon
              name="i-lucide-activity"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.recent.empty') }}
            </p>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
