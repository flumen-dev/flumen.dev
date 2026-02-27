<script setup lang="ts">
const { t } = useI18n()
const store = useFocusStore()
const { user } = useUserSession()
const { settings, orgs } = useUserSettings()

// Load dismissed keys from persisted settings
watchEffect(() => {
  if (settings.value?.dismissedInbox !== undefined) {
    store.loadDismissedFromSettings(settings.value.dismissedInbox)
  }
})

// Build scope options: user's own repos + each org
const scopeOptions = computed(() => [
  {
    label: user.value?.login ?? 'Me',
    value: user.value?.login ?? '',
    avatar: { src: user.value?.avatarUrl, alt: user.value?.login ?? '' },
  },
  ...orgs.value.map(org => ({
    label: org.login,
    value: org.login,
    avatar: { src: org.avatarUrl, alt: org.login },
  })),
])

// Initialize scope if empty
watchEffect(() => {
  if (!store.inboxScope && user.value?.login) {
    store.setInboxScope(user.value.login)
  }
})

const selectedScope = computed({
  get: () => store.inboxScope,
  set: (val: string) => {
    if (val) store.setInboxScope(val)
  },
})

const selectedOption = computed(() =>
  scopeOptions.value.find(o => o.value === store.inboxScope),
)

// Collect unique repos from current results for repo filter
const ALL_REPOS = '__all__'

const repoOptions = computed(() => {
  const repos = new Set<string>()
  for (const item of store.inboxPRs.data) repos.add(item.repo)
  for (const item of store.inboxIssues.data) repos.add(item.repo)
  return [
    { label: t('focus.inbox.allRepos'), value: ALL_REPOS },
    ...[...repos].sort().map(r => ({ label: r, value: r })),
  ]
})

const selectedRepo = computed({
  get: () => store.inboxRepo || ALL_REPOS,
  set: (val: string) => store.setInboxRepo(val === ALL_REPOS ? '' : val),
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const searchInput = ref(store.inboxSearch)

function onSearchInput(val: string) {
  searchInput.value = val
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    store.setInboxSearch(val)
  }, 400)
}

onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
    searchTimeout = null
  }
})

// Track last known item counts to avoid layout shift on reload
const lastPRCount = ref(3)
const lastIssueCount = ref(3)

watch(() => store.inboxPRs.data, (items) => {
  if (items.length > 0) lastPRCount.value = items.length
})
watch(() => store.inboxIssues.data, (items) => {
  if (items.length > 0) lastIssueCount.value = items.length
})

// --- Dismissed view toggle ---
const showDismissed = ref(false)

const dismissedCount = computed(() => store.dismissedKeys.size)

watch(dismissedCount, (count) => {
  if (count === 0) showDismissed.value = false
})

// --- Keyboard shortcuts ---
const helpOpen = ref(false)

const inboxActive = computed(() => store.expanded === 'inbox')

defineShortcuts({
  j: () => { if (inboxActive.value) store.highlightNext() },
  k: () => { if (inboxActive.value) store.highlightPrev() },
  d: () => { if (inboxActive.value) store.toggleDismiss() },
  x: () => { if (inboxActive.value && store.highlightedKey) store.toggleSelect(store.highlightedKey) },
  enter: () => { if (inboxActive.value) store.openHighlighted() },
})

// Manual listener for '?' — defineShortcuts rejects it because Shift mismatch across browsers
function onQuestionMark(e: KeyboardEvent) {
  if (e.key !== '?' || !inboxActive.value) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
  e.preventDefault()
  helpOpen.value = !helpOpen.value
}

onMounted(() => window.addEventListener('keydown', onQuestionMark))
onUnmounted(() => window.removeEventListener('keydown', onQuestionMark))
</script>

<template>
  <div>
    <!-- Filters -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-default">
      <USelectMenu
        v-model="selectedScope"
        :items="scopeOptions"
        value-key="value"
        label-key="label"
        class="w-48"
        size="sm"
      >
        <template #leading>
          <UAvatar
            v-if="selectedOption?.avatar"
            :src="selectedOption.avatar.src"
            :alt="selectedOption.avatar.alt"
            size="3xs"
          />
        </template>
      </USelectMenu>

      <USelectMenu
        v-model="selectedRepo"
        :items="repoOptions"
        value-key="value"
        label-key="label"
        class="w-48"
        size="sm"
        :placeholder="t('focus.inbox.allRepos')"
      />

      <UInput
        :model-value="searchInput"
        :placeholder="t('focus.inbox.searchPlaceholder')"
        icon="i-lucide-search"
        size="sm"
        class="flex-1"
        @update:model-value="onSearchInput"
      />

      <button
        v-if="dismissedCount > 0"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors cursor-pointer shrink-0"
        :class="showDismissed
          ? 'text-highlighted bg-elevated border-primary'
          : 'text-muted hover:text-highlighted hover:bg-elevated border-default'"
        @click="showDismissed = !showDismissed"
      >
        <UIcon
          name="i-lucide-eye-off"
          class="size-3.5"
        />
        {{ t('focus.inbox.dismissed') }}
        <UBadge
          :label="String(dismissedCount)"
          color="neutral"
          variant="subtle"
          size="xs"
        />
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-highlighted rounded-md hover:bg-elevated border border-default transition-colors cursor-pointer shrink-0"
        @click="helpOpen = true"
      >
        <UIcon
          name="i-lucide-keyboard"
          class="size-4"
        />
        <kbd class="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] leading-none">?</kbd>
      </button>
    </div>

    <!-- Batch action bar -->
    <div
      v-if="store.selectedKeys.size > 0"
      class="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20"
    >
      <span class="text-xs font-medium">
        {{ t('focus.inbox.selected', { count: store.selectedKeys.size }) }}
      </span>
      <button
        v-if="!showDismissed"
        type="button"
        class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
        @click="store.dismissSelected()"
      >
        <UIcon
          name="i-lucide-eye-off"
          class="size-3.5"
        />
        {{ t('focus.inbox.dismissSelected') }}
      </button>
      <button
        v-if="showDismissed"
        type="button"
        class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
        @click="store.restoreSelected()"
      >
        <UIcon
          name="i-lucide-eye"
          class="size-3.5"
        />
        {{ t('focus.inbox.restoreSelected') }}
      </button>
      <button
        type="button"
        class="text-xs text-muted hover:text-highlighted cursor-pointer"
        @click="store.clearSelection()"
      >
        {{ t('focus.inbox.clearSelection') }}
      </button>
    </div>

    <!-- PRs sub-section -->
    <div class="border-b border-default">
      <div class="flex items-center gap-2 px-4 py-2 bg-muted/50">
        <UIcon
          name="i-lucide-git-pull-request"
          class="size-4 text-blue-500"
        />
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">
          {{ t('focus.inbox.prs') }}
        </span>
        <UBadge
          v-if="!store.inboxPRs.loading"
          :label="String(store.inboxPRs.totalCount)"
          color="primary"
          variant="solid"
          size="sm"
        />
        <div
          class="flex items-center gap-1 ml-auto"
          role="group"
          :aria-label="t('focus.inbox.prs')"
        >
          <button
            type="button"
            :aria-pressed="store.inboxPRStateFilter === 'open'"
            @click="store.setInboxPRState('open')"
          >
            <UBadge
              :label="t('focus.inbox.open')"
              :color="store.inboxPRStateFilter === 'open' ? 'primary' : 'neutral'"
              :variant="store.inboxPRStateFilter === 'open' ? 'solid' : 'subtle'"
              size="sm"
            />
          </button>
          <button
            type="button"
            :aria-pressed="store.inboxPRStateFilter === 'closed'"
            @click="store.setInboxPRState('closed')"
          >
            <UBadge
              :label="t('focus.inbox.merged')"
              :color="store.inboxPRStateFilter === 'closed' ? 'primary' : 'neutral'"
              :variant="store.inboxPRStateFilter === 'closed' ? 'solid' : 'subtle'"
              size="sm"
            />
          </button>
        </div>
      </div>

      <div v-if="store.inboxPRs.loading">
        <FocusInboxCardSkeleton
          v-for="i in lastPRCount"
          :key="`pr-skel-${i}`"
        />
      </div>

      <template v-else-if="showDismissed">
        <div
          v-if="store.dismissedPRs.length === 0"
          class="px-4 py-3 text-center"
        >
          <p class="text-xs text-muted">
            {{ t('focus.inbox.noPRs') }}
          </p>
        </div>
        <div
          v-for="item in store.dismissedPRs"
          :key="`dismissed-${item.repo}#${item.number}`"
          class="flex items-center gap-2 px-4 py-2 border-b border-default last:border-b-0 opacity-60"
        >
          <input
            type="checkbox"
            :checked="store.selectedKeys.has(`${item.repo}#${item.number}`)"
            :aria-label="`Select ${item.repo}#${item.number}`"
            class="size-4 shrink-0 accent-primary cursor-pointer"
            :class="store.selectedKeys.size > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus:opacity-100'"
            @click.stop="store.toggleSelect(`${item.repo}#${item.number}`)"
          >
          <div class="min-w-0 flex-1 text-sm truncate">
            {{ item.title }}
            <span class="text-xs text-dimmed">#{{ item.number }}</span>
          </div>
          <button
            type="button"
            class="text-xs text-primary hover:underline cursor-pointer shrink-0"
            @click="store.restoreItem(`${item.repo}#${item.number}`)"
          >
            {{ t('focus.inbox.restore') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div
          v-if="store.visiblePRs.length === 0"
          class="px-4 py-3 text-center"
        >
          <p class="text-xs text-muted">
            {{ t('focus.inbox.noPRs') }}
          </p>
        </div>
        <div v-else>
          <FocusInboxUnifiedCard
            v-for="item in store.visiblePRs"
            :key="`${item.repo}#${item.number}`"
            :item="item"
            :highlighted="store.highlightedKey === `${item.repo}#${item.number}`"
            :selected="store.selectedKeys.has(`${item.repo}#${item.number}`)"
          />
        </div>
      </template>

      <UiPaginator
        v-if="!showDismissed && !store.inboxPRs.loading && store.inboxPRs.totalPages > 1"
        :current-page="store.inboxPRs.page"
        :total-pages="store.inboxPRs.totalPages"
        :has-more="store.inboxPRs.hasMore"
        :has-previous="store.inboxPRs.hasPrevious"
        :paging="store.inboxPRs.paging"
        @next="store.inboxPRsNextPage()"
        @previous="store.inboxPRsPrevPage()"
      />
    </div>

    <!-- Issues sub-section -->
    <div>
      <div class="flex items-center gap-2 px-4 py-2 bg-muted/50">
        <UIcon
          name="i-lucide-circle-dot"
          class="size-4 text-emerald-500"
        />
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">
          {{ t('focus.inbox.issues') }}
        </span>
        <UBadge
          v-if="!store.inboxIssues.loading"
          :label="String(store.inboxIssues.totalCount)"
          color="primary"
          variant="solid"
          size="sm"
        />
        <div
          class="flex items-center gap-1 ml-auto"
          role="group"
          :aria-label="t('focus.inbox.issues')"
        >
          <button
            type="button"
            :aria-pressed="store.inboxIssueStateFilter === 'open'"
            @click="store.setInboxIssueState('open')"
          >
            <UBadge
              :label="t('focus.inbox.open')"
              :color="store.inboxIssueStateFilter === 'open' ? 'primary' : 'neutral'"
              :variant="store.inboxIssueStateFilter === 'open' ? 'solid' : 'subtle'"
              size="sm"
            />
          </button>
          <button
            type="button"
            :aria-pressed="store.inboxIssueStateFilter === 'closed'"
            @click="store.setInboxIssueState('closed')"
          >
            <UBadge
              :label="t('focus.inbox.closed')"
              :color="store.inboxIssueStateFilter === 'closed' ? 'primary' : 'neutral'"
              :variant="store.inboxIssueStateFilter === 'closed' ? 'solid' : 'subtle'"
              size="sm"
            />
          </button>
        </div>
      </div>

      <div v-if="store.inboxIssues.loading">
        <FocusInboxCardSkeleton
          v-for="i in lastIssueCount"
          :key="`issue-skel-${i}`"
        />
      </div>

      <template v-else-if="showDismissed">
        <div
          v-if="store.dismissedIssues.length === 0"
          class="px-4 py-3 text-center"
        >
          <p class="text-xs text-muted">
            {{ t('focus.inbox.noIssues') }}
          </p>
        </div>
        <div
          v-for="item in store.dismissedIssues"
          :key="`dismissed-${item.repo}#${item.number}`"
          class="flex items-center gap-2 px-4 py-2 border-b border-default last:border-b-0 opacity-60"
        >
          <input
            type="checkbox"
            :checked="store.selectedKeys.has(`${item.repo}#${item.number}`)"
            :aria-label="`Select ${item.repo}#${item.number}`"
            class="size-4 shrink-0 accent-primary cursor-pointer"
            :class="store.selectedKeys.size > 0 ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus:opacity-100'"
            @click.stop="store.toggleSelect(`${item.repo}#${item.number}`)"
          >
          <div class="min-w-0 flex-1 text-sm truncate">
            {{ item.title }}
            <span class="text-xs text-dimmed">#{{ item.number }}</span>
          </div>
          <button
            type="button"
            class="text-xs text-primary hover:underline cursor-pointer shrink-0"
            @click="store.restoreItem(`${item.repo}#${item.number}`)"
          >
            {{ t('focus.inbox.restore') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div
          v-if="store.visibleIssues.length === 0"
          class="px-4 py-3 text-center"
        >
          <p class="text-xs text-muted">
            {{ t('focus.inbox.noIssues') }}
          </p>
        </div>
        <div v-else>
          <FocusInboxUnifiedCard
            v-for="item in store.visibleIssues"
            :key="`${item.repo}#${item.number}`"
            :item="item"
            :highlighted="store.highlightedKey === `${item.repo}#${item.number}`"
            :selected="store.selectedKeys.has(`${item.repo}#${item.number}`)"
          />
        </div>
      </template>

      <UiPaginator
        v-if="!showDismissed && !store.inboxIssues.loading && store.inboxIssues.totalPages > 1"
        :current-page="store.inboxIssues.page"
        :total-pages="store.inboxIssues.totalPages"
        :has-more="store.inboxIssues.hasMore"
        :has-previous="store.inboxIssues.hasPrevious"
        :paging="store.inboxIssues.paging"
        @next="store.inboxIssuesNextPage()"
        @previous="store.inboxIssuesPrevPage()"
      />
    </div>

    <!-- Keyboard shortcuts help modal -->
    <UModal v-model:open="helpOpen">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            {{ t('focus.inbox.shortcuts.title') }}
          </h3>
          <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <kbd class="px-2 py-0.5 bg-muted rounded font-mono text-xs">j</kbd>
            <span>{{ t('focus.inbox.shortcuts.next') }}</span>
            <kbd class="px-2 py-0.5 bg-muted rounded font-mono text-xs">k</kbd>
            <span>{{ t('focus.inbox.shortcuts.prev') }}</span>
            <kbd class="px-2 py-0.5 bg-muted rounded font-mono text-xs">Enter</kbd>
            <span>{{ t('focus.inbox.shortcuts.open') }}</span>
            <kbd class="px-2 py-0.5 bg-muted rounded font-mono text-xs">d</kbd>
            <span>{{ t('focus.inbox.shortcuts.dismiss') }}</span>
            <kbd class="px-2 py-0.5 bg-muted rounded font-mono text-xs">x</kbd>
            <span>{{ t('focus.inbox.shortcuts.select') }}</span>
            <kbd class="px-2 py-0.5 bg-muted rounded font-mono text-xs">?</kbd>
            <span>{{ t('focus.inbox.shortcuts.help') }}</span>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
