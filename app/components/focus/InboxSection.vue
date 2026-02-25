<script setup lang="ts">
const { t } = useI18n()
const store = useFocusStore()
const { user } = useUserSession()
const { orgs } = useUserSettings()

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

      <div
        v-else-if="store.inboxPRs.data.length === 0"
        class="px-4 py-3 text-center"
      >
        <p class="text-xs text-muted">
          {{ t('focus.inbox.noPRs') }}
        </p>
      </div>

      <div v-else>
        <FocusInboxUnifiedCard
          v-for="item in store.inboxPRs.data"
          :key="`${item.repo}#${item.number}`"
          :item="item"
        />
      </div>

      <UiPaginator
        v-if="!store.inboxPRs.loading && store.inboxPRs.totalPages > 1"
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

      <div
        v-else-if="store.inboxIssues.data.length === 0"
        class="px-4 py-3 text-center"
      >
        <p class="text-xs text-muted">
          {{ t('focus.inbox.noIssues') }}
        </p>
      </div>

      <div v-else>
        <FocusInboxUnifiedCard
          v-for="item in store.inboxIssues.data"
          :key="`${item.repo}#${item.number}`"
          :item="item"
        />
      </div>

      <UiPaginator
        v-if="!store.inboxIssues.loading && store.inboxIssues.totalPages > 1"
        :current-page="store.inboxIssues.page"
        :total-pages="store.inboxIssues.totalPages"
        :has-more="store.inboxIssues.hasMore"
        :has-previous="store.inboxIssues.hasPrevious"
        :paging="store.inboxIssues.paging"
        @next="store.inboxIssuesNextPage()"
        @previous="store.inboxIssuesPrevPage()"
      />
    </div>
  </div>
</template>
