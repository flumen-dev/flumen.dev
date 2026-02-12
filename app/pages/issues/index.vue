<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const { t } = useI18n()
const store = useIssueStore()

const openCount = computed(() =>
  store.stateFilter === 'open'
    ? store.issues.length
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

      <!-- Loading -->
      <div
        v-else-if="store.loading"
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
          </button>
        </div>

        <!-- Issue list -->
        <div
          v-if="store.issues.length"
          class="rounded-lg border border-default divide-y divide-default overflow-hidden"
        >
          <IssueRow
            v-for="issue in store.issues"
            :key="issue.id"
            :issue="issue"
          />
        </div>

        <!-- Empty -->
        <p
          v-else
          class="py-8 text-center text-sm text-muted"
        >
          {{ t('issues.noResults') }}
        </p>
      </template>
    </template>
  </div>
</template>
