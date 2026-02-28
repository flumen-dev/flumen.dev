<script setup lang="ts">
const { t } = useI18n()
const store = useDashboardStore()

const PAGE_SIZE = 10
const page = ref(1)

const totalPages = computed(() =>
  Math.ceil(store.prHealth.data.length / PAGE_SIZE),
)

const pagedItems = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return store.prHealth.data.slice(start, start + PAGE_SIZE)
})

const panelCollapsed = computed(() => store.isCollapsed('prHealth'))

const summaryText = computed(() => {
  const s = store.prHealth.summary
  if (!s) return ''
  return t('dashboard.prHealth.collapsed', {
    count: s.totalIssues,
    ci: s.ciFailures,
    conflicts: s.conflicts,
  })
})

// Reset page when data changes
watch(() => store.prHealth.data.length, () => {
  page.value = 1
})
</script>

<template>
  <div class="rounded-lg border border-default overflow-hidden">
    <!-- Header -->
    <button
      class="flex w-full items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-elevated transition-colors"
      @click="store.togglePanel('prHealth')"
    >
      <UIcon
        name="i-lucide-heart-pulse"
        class="size-5 text-highlighted shrink-0"
      />
      <h2 class="text-sm font-semibold text-highlighted">
        {{ t('dashboard.prHealth.title') }}
      </h2>
      <UBadge
        v-if="store.prHealth.data.length > 0"
        :label="String(store.prHealth.data.length)"
        color="error"
        variant="subtle"
        size="sm"
      />
      <span
        v-if="panelCollapsed && store.prHealth.summary"
        class="text-xs text-muted truncate"
      >
        {{ summaryText }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <UIcon
          v-if="store.prHealth.loading"
          name="i-lucide-loader-2"
          class="size-4 text-dimmed animate-spin"
        />
        <UIcon
          :name="panelCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          class="size-4 text-dimmed"
        />
      </div>
    </button>

    <template v-if="!panelCollapsed">
      <!-- Loading -->
      <div
        v-if="store.prHealth.loading && !store.prHealth.fetchedAt"
        class="p-8 flex items-center justify-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="size-4 animate-spin"
        />
        {{ t('common.loading') }}
      </div>

      <!-- Error -->
      <div
        v-else-if="store.prHealth.error"
        class="p-8 text-center"
      >
        <p class="text-sm text-muted">
          {{ t('common.retry') }}
        </p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="store.prHealth.fetchedAt && store.prHealth.data.length === 0"
        class="p-8 text-center"
      >
        <UIcon
          name="i-lucide-check-circle"
          class="size-10 text-emerald-500 mx-auto mb-3"
        />
        <p class="text-sm font-medium text-highlighted">
          {{ t('dashboard.prHealth.empty') }}
        </p>
      </div>

      <!-- Content -->
      <template v-else-if="store.prHealth.data.length > 0">
        <!-- Summary banner -->
        <div class="flex items-center gap-2 px-4 py-2.5 bg-error/10 border-y border-error/20">
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-4 text-error shrink-0"
          />
          <p class="text-xs font-medium text-error">
            {{ t('dashboard.prHealth.summary', {
              issues: store.prHealth.summary?.totalIssues ?? 0,
              ci: store.prHealth.summary?.ciFailures ?? 0,
              conflicts: store.prHealth.summary?.conflicts ?? 0,
            }) }}
          </p>
        </div>

        <!-- Items grid -->
        <div class="p-3 grid gap-2">
          <DashboardPRHealthCard
            v-for="item in pagedItems"
            :key="`${item.repo}#${item.number}`"
            :item="item"
          />
        </div>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="border-t border-default"
        >
          <UiPaginator
            :current-page="page"
            :total-pages="totalPages"
            :has-more="page < totalPages"
            :has-previous="page > 1"
            @next="page++"
            @previous="page--"
          />
        </div>
      </template>
    </template>
  </div>
</template>
