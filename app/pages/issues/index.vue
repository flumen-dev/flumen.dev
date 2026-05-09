<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const { t } = useI18n()
const localePath = useLocalePath()
const store = useIssueStore()

async function setFilter(state: 'open' | 'closed') {
  await store.setStateFilter(state)
}
</script>

<template>
  <div class="p-2 sm:p-4 space-y-3 sm:space-y-4">
    <!-- Repo selector -->
    <div class="flex items-center gap-2">
      <IssueRepoSelect />
      <RepoStarButton
        v-if="store.selectedRepo"
        :repo="store.selectedRepo"
        show-count
      />
    </div>

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
        <div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
          <IssueRowSkeleton
            v-for="n in 6"
            :key="n"
          />
        </div>
      </template>

      <!-- Loaded -->
      <template v-else-if="store.loaded">
        <!-- Highlights: Assigned-to-me | Mentioned | Authored-by-me -->
        <div
          v-if="store.stateFilter === 'open'"
          class="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          <IssueHighlightCard
            :title="t('issues.highlight.assignedToMe')"
            icon-key="i-lucide-user-check"
            icon-class="text-emerald-500"
            :items="store.assignedToMe.data"
            :loading="store.assignedToMe.loading"
            :empty-text="t('issues.highlight.assignedToMeEmpty')"
            :total-count="store.assignedToMe.totalCount"
            :current-page="store.assignedToMe.currentPage"
            :total-pages="store.assignedToMe.totalPages"
            :has-more="store.assignedToMe.hasMore"
            :has-previous="store.assignedToMe.hasPrevious"
            :paging="store.assignedToMe.paging"
            @next="store.assignedToMe.nextPage()"
            @previous="store.assignedToMe.prevPage()"
          />
          <IssueHighlightCard
            :title="t('issues.highlight.mentioned')"
            icon-key="i-lucide-at-sign"
            icon-class="text-rose-500"
            :items="store.mentioned.data"
            :loading="store.mentioned.loading"
            :empty-text="t('issues.highlight.mentionedEmpty')"
            :total-count="store.mentioned.totalCount"
            :current-page="store.mentioned.currentPage"
            :total-pages="store.mentioned.totalPages"
            :has-more="store.mentioned.hasMore"
            :has-previous="store.mentioned.hasPrevious"
            :paging="store.mentioned.paging"
            @next="store.mentioned.nextPage()"
            @previous="store.mentioned.prevPage()"
          />
          <IssueHighlightCard
            :title="t('issues.highlight.authoredByMe')"
            icon-key="i-lucide-pencil"
            icon-class="text-blue-500"
            :items="store.authoredByMe.data"
            :loading="store.authoredByMe.loading"
            :empty-text="t('issues.highlight.authoredByMeEmpty')"
            :total-count="store.authoredByMe.totalCount"
            :current-page="store.authoredByMe.currentPage"
            :total-pages="store.authoredByMe.totalPages"
            :has-more="store.authoredByMe.hasMore"
            :has-previous="store.authoredByMe.hasPrevious"
            :paging="store.authoredByMe.paging"
            @next="store.authoredByMe.nextPage()"
            @previous="store.authoredByMe.prevPage()"
          />
        </div>

        <!-- State tabs + Create -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <IssueStateTab
            :label="t('issues.open')"
            icon-key="i-lucide-circle-dot"
            :active="store.stateFilter === 'open'"
            :loading="store.loading"
            :count="store.openCount"
            @select="setFilter('open')"
          />
          <IssueStateTab
            :label="t('issues.closed')"
            icon-key="i-lucide-check-circle"
            :active="store.stateFilter === 'closed'"
            :loading="store.loading"
            :count="store.closedCount"
            @select="setFilter('closed')"
          />
          <div class="ml-auto">
            <UButton
              :label="t('issues.create.button')"
              icon="i-lucide-plus"
              size="sm"
              :to="localePath({ path: '/issues/new', query: { repo: store.selectedRepo } })"
            />
          </div>
        </div>

        <!-- Filter bar (search + chips + clear) -->
        <IssueFilterBar />

        <!-- Main list (filtered or full) -->
        <div
          class="space-y-3 transition-opacity duration-150"
          :class="store.loading || store.searching ? 'opacity-50 pointer-events-none' : ''"
        >
          <div
            v-if="store.hasActiveFilters"
            class="px-1 text-xs font-medium text-muted uppercase tracking-wider"
          >
            {{ t('issues.filtered.heading') }}
            <span class="text-muted/70">({{ store.sortedIssues.length }})</span>
          </div>

          <div
            v-if="store.sortedIssues.length"
            class="rounded-lg border border-default divide-y divide-default overflow-hidden"
          >
            <IssueRow
              v-for="issue in store.sortedIssues"
              :key="issue.id"
              :issue="issue"
            />
          </div>
          <p
            v-else
            class="px-4 py-8 text-center text-sm text-muted"
          >
            {{ store.hasActiveFilters ? t('issues.filtered.empty') : t('issues.empty') }}
          </p>
        </div>

        <!-- Pagination — only on the unfiltered main list (search uses its own flat list). -->
        <UiPaginator
          v-if="!store.hasActiveFilters && store.sortedIssues.length"
          :current-page="store.currentPage"
          :total-pages="store.totalPages"
          :has-more="store.hasMore"
          :has-previous="store.hasPrevious"
          :paging="store.paging"
          @next="store.loadNextPage()"
          @previous="store.loadPreviousPage()"
        />
      </template>
    </template>
  </div>
</template>
