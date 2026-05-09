<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.pulls',
})

const { t } = useI18n()
const issueStore = useIssueStore()
const store = usePullRequestStore()

// Repo selection currently lives on issueStore (see IssueRepoSelect). The PR
// store mirrors it via this watcher so picking a repo on either page keeps
// both lists in sync. Extracting a generic RepoSelect is tracked separately.
watch(() => issueStore.selectedRepo, (repo) => {
  if (repo && repo !== store.selectedRepo) store.selectRepo(repo)
}, { immediate: true })

async function setStateFilter(state: 'open' | 'closed' | 'merged') {
  if (store.stateFilter === state) return
  await store.setStateFilter(state)
}
</script>

<template>
  <div class="p-2 sm:p-4 space-y-3 sm:space-y-4">
    <div class="flex items-center gap-2">
      <IssueRepoSelect />
    </div>

    <template v-if="store.selectedRepo">
      <div
        v-if="store.errorKey"
        class="space-y-3"
      >
        <UAlert
          :title="t(`pulls.error.${store.errorKey}.title`)"
          :description="t(`pulls.error.${store.errorKey}.description`)"
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

      <template v-else>
        <!-- Highlights: Ready-to-merge | Reviews-requested -->
        <div
          v-if="store.stateFilter === 'open'"
          class="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2"
        >
          <PullRequestHighlightCard
            :title="t('pulls.highlight.readyToMerge')"
            icon-key="i-lucide-check-circle-2"
            icon-class="text-emerald-500"
            :items="store.readyToMerge.items"
            :loading="store.readyToMerge.loading"
            :empty-text="t('pulls.highlight.readyToMergeEmpty')"
            :total-count="store.readyToMerge.totalCount"
            :current-page="store.readyToMerge.currentPage"
            :total-pages="store.readyToMerge.totalPages"
            :has-more="store.readyToMerge.hasMore"
            :has-previous="store.readyToMerge.hasPrevious"
            :paging="store.readyToMerge.paging"
            @next="store.loadHighlightNext('ready')"
            @previous="store.loadHighlightPrevious('ready')"
          />
          <PullRequestHighlightCard
            :title="t('pulls.highlight.reviewsRequested')"
            icon-key="i-lucide-eye"
            icon-class="text-rose-500"
            :items="store.reviewsRequested.items"
            :loading="store.reviewsRequested.loading"
            :empty-text="t('pulls.highlight.reviewsRequestedEmpty')"
            :total-count="store.reviewsRequested.totalCount"
            :current-page="store.reviewsRequested.currentPage"
            :total-pages="store.reviewsRequested.totalPages"
            :has-more="store.reviewsRequested.hasMore"
            :has-previous="store.reviewsRequested.hasPrevious"
            :paging="store.reviewsRequested.paging"
            @next="store.loadHighlightNext('reviews')"
            @previous="store.loadHighlightPrevious('reviews')"
          />
        </div>

        <!-- State tabs -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
          <UButton
            :label="t('pulls.open')"
            icon="i-lucide-git-pull-request"
            :variant="store.stateFilter === 'open' ? 'solid' : 'outline'"
            color="neutral"
            size="sm"
            @click="setStateFilter('open')"
          />
          <UButton
            :label="t('pulls.merged')"
            icon="i-lucide-git-merge"
            :variant="store.stateFilter === 'merged' ? 'solid' : 'outline'"
            color="neutral"
            size="sm"
            @click="setStateFilter('merged')"
          />
          <UButton
            :label="t('pulls.closed')"
            icon="i-lucide-git-pull-request-closed"
            :variant="store.stateFilter === 'closed' ? 'solid' : 'outline'"
            color="neutral"
            size="sm"
            @click="setStateFilter('closed')"
          />
        </div>

        <!-- Initial loading -->
        <template v-if="store.loading && !store.loaded">
          <div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
            <PullRequestRowSkeleton
              v-for="n in 6"
              :key="n"
            />
          </div>
        </template>

        <!-- Main list -->
        <template v-else-if="store.loaded">
          <div
            class="rounded-lg border border-default divide-y divide-default overflow-hidden transition-opacity duration-150"
            :class="store.loading ? 'opacity-50 pointer-events-none' : ''"
          >
            <PullRequestRow
              v-for="pr in store.prs"
              :key="pr.id"
              :pr="pr"
            />
            <p
              v-if="!store.prs.length"
              class="px-4 py-8 text-center text-sm text-muted"
            >
              {{ t('pulls.empty') }}
            </p>
          </div>

          <UiPaginator
            v-if="store.prs.length"
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
    </template>

    <p
      v-else
      class="text-sm text-muted text-center py-12"
    >
      {{ t('pulls.selectRepo') }}
    </p>
  </div>
</template>
