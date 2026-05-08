<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const { t } = useI18n()
const localePath = useLocalePath()
const store = useIssueStore()

const openCount = computed(() =>
  store.stateFilter === 'open'
    ? store.totalCount
    : null,
)

const closedCount = computed(() =>
  store.stateFilter === 'closed'
    ? store.totalCount
    : null,
)

async function setFilter(state: 'open' | 'closed') {
  if (store.stateFilter === state) return
  store.stateFilter = state
  await store.fetchIssues()
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Repo selector -->
    <div class="flex items-center gap-2">
      <IssueRepoSelect />
      <RepoStarButton
        v-if="store.selectedRepo"
        :repo="store.selectedRepo"
        show-count
      />
    </div>

    <!-- Content: only show after repo selected -->
    <template v-if="store.selectedRepo">
      <!-- Error -->
      <div
        v-if="store.errorKey"
        class="space-y-3"
      >
        <UAlert
          :title="t(`issues.error.${store.errorKey}.title`)"
          :description="t(`issues.error.${store.errorKey}.description`)"
          :color="store.errorKey === 'rateLimited' ? 'warning' : 'error'"
          :icon="store.errorKey === 'sessionExpired' ? 'i-lucide-log-out' : store.errorKey === 'rateLimited' ? 'i-lucide-clock' : 'i-lucide-alert-triangle'"
        />
        <UButton
          :label="t('common.retry')"
          icon="i-lucide-refresh-cw"
          variant="outline"
          @click="store.refresh()"
        />
      </div>

      <!-- Loading (initial) -->
      <template v-else-if="store.loading && !store.loaded">
        <div class="flex items-center gap-4">
          <USkeleton class="h-5 w-20 rounded" />
          <USkeleton class="h-5 w-20 rounded" />
          <USkeleton class="ml-auto h-8 w-24 rounded-md" />
        </div>
        <div class="flex items-center gap-3">
          <USkeleton class="h-9 flex-1 rounded-md" />
          <USkeleton class="h-4 w-20 rounded" />
        </div>
        <div class="flex items-center gap-2">
          <USkeleton
            v-for="n in 4"
            :key="n"
            class="h-7 w-20 rounded-md"
          />
          <USkeleton class="ml-auto h-7 w-28 rounded-md" />
        </div>
        <div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
          <IssueRowSkeleton
            v-for="n in 8"
            :key="n"
          />
        </div>
      </template>

      <!-- Loaded -->
      <template v-else-if="store.loaded">
        <!-- State tabs -->
        <div class="flex items-center gap-4">
          <button
            class="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            :class="store.stateFilter === 'open' ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
            @click="setFilter('open')"
          >
            <UIcon
              name="i-lucide-circle-dot"
              class="size-4"
            />
            {{ t('issues.open') }}
            <span
              v-if="openCount !== null"
              class="text-xs text-muted"
            >({{ openCount }})</span>
          </button>
          <button
            class="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            :class="store.stateFilter === 'closed' ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
            @click="setFilter('closed')"
          >
            <UIcon
              name="i-lucide-check-circle"
              class="size-4"
            />
            {{ t('issues.closed') }}
            <span
              v-if="closedCount !== null"
              class="text-xs text-muted"
            >({{ closedCount }})</span>
          </button>
          <div class="ml-auto">
            <UButton
              :label="t('issues.create.button')"
              icon="i-lucide-plus"
              size="sm"
              :to="localePath({ path: '/issues/new', query: { repo: store.selectedRepo } })"
            />
          </div>
        </div>

        <!-- Toolbar -->
        <IssueToolbar />

        <!-- Loading (filter/state change) or searching -->
        <div
          v-if="store.loading || store.searching"
          class="rounded-lg border border-default divide-y divide-default overflow-hidden"
        >
          <IssueRowSkeleton
            v-for="n in 6"
            :key="n"
          />
        </div>

        <!-- Issue list -->
        <div
          v-else-if="store.sortedIssues.length"
          class="space-y-4"
        >
          <div
            class="rounded-lg border border-default divide-y divide-default overflow-hidden transition-opacity duration-200"
            :class="store.paging ? 'opacity-50 pointer-events-none' : ''"
          >
            <IssueRow
              v-for="issue in store.sortedIssues"
              :key="issue.id"
              :issue="issue"
            />
          </div>

          <!-- Pagination (only when not searching) -->
          <UiPaginator
            v-if="!store.search"
            :current-page="store.currentPage"
            :total-pages="store.totalPages"
            :has-more="store.hasMore"
            :has-previous="store.hasPrevious"
            :paging="store.paging"
            @next="store.loadNextPage()"
            @previous="store.loadPreviousPage()"
          />
        </div>

        <!-- Empty -->
        <p
          v-else-if="!store.searching"
          class="py-8 text-center text-sm text-muted"
        >
          {{ t('issues.noResults') }}
        </p>
      </template>
    </template>
  </div>
</template>
