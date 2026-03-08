<script lang="ts" setup>
import type { WorkItem } from '~~/shared/types/work-item'

definePageMeta({
  middleware: 'auth',
  titleKey: 'repos.detail.workItems',
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const store = useWorkItemStore()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
const repoFullName = computed(() => `${owner.value}/${repo.value}`)

const openCount = computed(() =>
  store.stateFilter === 'open' ? store.totalCount : null,
)

const closedCount = computed(() =>
  store.stateFilter === 'closed' ? store.totalCount : null,
)

async function setFilter(state: 'open' | 'closed') {
  if (store.stateFilter === state) return
  store.stateFilter = state
  await store.fetchWorkItems()
}

function initRepo() {
  store.selectRepo(repoFullName.value)
}

initRepo()
watch(repoFullName, initRepo)

// --- Work item helpers (same as RepoWorkItemList) ---

const STATE_COLOR: Record<string, string> = {
  OPEN: 'success',
  CLOSED: 'neutral',
  MERGED: 'primary',
  DRAFT: 'neutral',
}

function stateBadgeColor(state: string) {
  return STATE_COLOR[state] ?? 'neutral'
}

function stateBadgeLabel(item: WorkItem) {
  if (item.type === 'pull' && item.isDraft) return t('repos.workItem.state.draft')
  if (item.state === 'MERGED') return t('repos.workItem.state.merged')
  if (item.state === 'CLOSED') return t('repos.workItem.state.closed')
  return t('repos.workItem.state.open')
}

function prStatusLabel(item: WorkItem) {
  if (item.type === 'pull') {
    if (item.isDraft) return t('repos.workItem.status.draft')
    if (item.state === 'MERGED') return t('repos.workItem.status.merged')
    if (item.reviewDecision === 'APPROVED') return t('repos.workItem.status.approved')
    if (item.reviewDecision === 'CHANGES_REQUESTED') return t('repos.workItem.status.changesRequested')
    if (item.reviewDecision === 'REVIEW_REQUIRED') return t('repos.workItem.status.reviewRequested')
    if (item.state === 'CLOSED') return t('repos.workItem.status.closed')
    return t('repos.workItem.status.open')
  }

  if (!item.linkedPulls.length) return null
  if (item.reviewDecision === 'APPROVED') return t('repos.workItem.status.prApproved')
  if (item.reviewDecision === 'CHANGES_REQUESTED') return t('repos.workItem.status.prChangesRequested')
  if (item.reviewDecision === 'REVIEW_REQUIRED') return t('repos.workItem.status.prReviewRequested')
  return t('repos.workItem.status.prLinked')
}

function ciIcon(ciStatus: WorkItem['ciStatus']) {
  return getCIIcon(ciStatus)
}

function navigateToItem(item: WorkItem) {
  router.push(localePath(`/repos/${owner.value}/${repo.value}/work-items/${item.id}`))
}
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
    </div>

    <!-- Error -->
    <div
      v-if="store.errorKey"
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
        @click="store.refresh()"
      />
    </div>

    <!-- Loading (initial) -->
    <template v-else-if="store.loading && !store.loaded">
      <div class="flex items-center gap-4">
        <USkeleton class="h-5 w-20 rounded" />
        <USkeleton class="h-5 w-20 rounded" />
      </div>
      <div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
        <div
          v-for="n in 8"
          :key="n"
          class="flex items-start gap-2.5 px-3 py-2.5"
        >
          <USkeleton class="size-4 rounded-full shrink-0 mt-0.5" />
          <div class="flex-1 space-y-2">
            <USkeleton class="h-4 w-3/4 rounded" />
            <USkeleton class="h-3 w-1/2 rounded" />
          </div>
        </div>
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
          {{ t('workItems.open') }}
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
          {{ t('workItems.closed') }}
          <span
            v-if="closedCount !== null"
            class="text-xs text-muted"
          >({{ closedCount }})</span>
        </button>
      </div>

      <!-- Loading (filter/state change) -->
      <div
        v-if="store.loading"
        class="rounded-lg border border-default divide-y divide-default overflow-hidden"
      >
        <div
          v-for="n in 6"
          :key="n"
          class="flex items-start gap-2.5 px-3 py-2.5"
        >
          <USkeleton class="size-4 rounded-full shrink-0 mt-0.5" />
          <div class="flex-1 space-y-2">
            <USkeleton class="h-4 w-3/4 rounded" />
            <USkeleton class="h-3 w-1/2 rounded" />
          </div>
        </div>
      </div>

      <!-- Work item list -->
      <div
        v-else-if="store.sortedWorkItems.length"
        class="space-y-4"
      >
        <div
          class="rounded-lg border border-default divide-y divide-default overflow-hidden transition-opacity duration-200"
          :class="store.paging ? 'opacity-50 pointer-events-none' : ''"
        >
          <div
            v-for="item in store.sortedWorkItems"
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

        <!-- Pagination -->
        <UiPaginator
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
        v-else
        class="py-8 text-center text-sm text-muted"
      >
        {{ t('workItems.noResults') }}
      </p>
    </template>
  </div>
</template>
