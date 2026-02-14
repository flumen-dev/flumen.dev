<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const { t } = useI18n()
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
    <IssueRepoSelect />

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
      <div
        v-else-if="store.loading && !store.loaded"
        class="py-8 text-center text-muted"
      >
        {{ t('common.loading') }}
      </div>

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
        </div>

        <!-- Toolbar -->
        <IssueToolbar />

        <!-- Searching indicator -->
        <div
          v-if="store.searching"
          class="py-4 text-center text-sm text-muted"
        >
          {{ t('issues.serverSearch') }}
        </div>

        <!-- Issue list -->
        <div
          v-else-if="store.filteredIssues.length"
          class="space-y-4"
        >
          <div
            class="rounded-lg border border-default divide-y divide-default overflow-hidden transition-opacity duration-200"
            :class="store.paging ? 'opacity-50 pointer-events-none' : ''"
          >
            <IssueRow
              v-for="issue in store.filteredIssues"
              :key="issue.id"
              :issue="issue"
            />
          </div>

          <!-- Pagination (only when not searching) -->
          <div
            v-if="!store.search && (store.hasPrevious || store.hasMore)"
            class="flex items-center justify-between"
          >
            <UButton
              :label="t('issues.previousPage')"
              icon="i-lucide-chevron-left"
              variant="outline"
              size="sm"
              :disabled="!store.hasPrevious"
              :loading="store.paging === 'prev'"
              @click="store.loadPreviousPage()"
            />
            <span class="text-sm text-muted">
              {{ t('issues.page', { current: store.currentPage, total: store.totalPages }) }}
            </span>
            <UButton
              :label="t('issues.nextPage')"
              trailing-icon="i-lucide-chevron-right"
              variant="outline"
              size="sm"
              :disabled="!store.hasMore"
              :loading="store.paging === 'next'"
              @click="store.loadNextPage()"
            />
          </div>
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
