<script setup lang="ts">
const { t } = useI18n()
const store = useDashboardStore()

const PAGE_SIZE = 10
const page = ref(1)

const totalPages = computed(() =>
  Math.ceil(store.waitingOnMe.data.length / PAGE_SIZE),
)

const pagedItems = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return store.waitingOnMe.data.slice(start, start + PAGE_SIZE)
})

const isOnLastPage = computed(() => page.value >= totalPages.value)

const panelCollapsed = computed(() => store.isCollapsed('waitingOnMe'))

const summaryText = computed(() => {
  const s = store.waitingOnMe.summary
  if (!s) return ''
  return t('dashboard.waitingOnMe.collapsed', {
    count: s.totalItems,
    days: s.averageWaitDays,
  })
})

// Reset page when data changes
watch(() => store.waitingOnMe.data.length, () => {
  page.value = 1
})
</script>

<template>
  <div class="rounded-lg border border-default overflow-hidden">
    <!-- Header -->
    <button
      class="flex w-full items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-elevated transition-colors"
      @click="store.togglePanel('waitingOnMe')"
    >
      <UIcon
        name="i-lucide-alarm-clock"
        class="size-5 text-highlighted shrink-0"
      />
      <h2 class="text-sm font-semibold text-highlighted">
        {{ t('focus.waitingOnMe.title') }}
      </h2>
      <UBadge
        v-if="store.waitingOnMe.data.length > 0"
        :label="String(store.waitingOnMe.data.length)"
        color="warning"
        variant="subtle"
        size="sm"
      />
      <span
        v-if="panelCollapsed && store.waitingOnMe.summary"
        class="text-xs text-muted truncate"
      >
        {{ summaryText }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <UIcon
          v-if="store.waitingOnMe.loading"
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
        v-if="store.waitingOnMe.loading && !store.waitingOnMe.fetchedAt"
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
        v-else-if="store.waitingOnMe.error"
        class="p-8 text-center"
      >
        <p class="text-sm text-muted">
          {{ t('common.retry') }}
        </p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="store.waitingOnMe.fetchedAt && store.waitingOnMe.data.length === 0"
        class="p-8 text-center"
      >
        <UIcon
          name="i-lucide-check-circle"
          class="size-10 text-emerald-500 mx-auto mb-3"
        />
        <p class="text-sm font-medium text-highlighted">
          {{ t('focus.waitingOnMe.empty') }}
        </p>
      </div>

      <!-- Content -->
      <template v-else-if="store.waitingOnMe.data.length > 0">
        <!-- Summary banner -->
        <div class="flex items-center gap-2 px-4 py-2.5 bg-warning/10 border-y border-warning/20">
          <UIcon
            name="i-lucide-alert-triangle"
            class="size-4 text-warning shrink-0"
          />
          <p class="text-xs font-medium text-warning">
            {{ t('focus.waitingOnMe.summary', {
              people: store.waitingOnMe.summary?.uniquePeopleBlocked ?? 0,
              days: store.waitingOnMe.summary?.averageWaitDays ?? 0,
            }) }}
          </p>
        </div>

        <!-- Items grid -->
        <div class="p-3 grid gap-2">
          <DashboardWaitingOnMeCard
            v-for="item in pagedItems"
            :key="`${item.repo}#${item.number}`"
            :item="item"
          />
        </div>

        <!-- Pagination + Load more -->
        <div class="border-t border-default">
          <UiPaginator
            v-if="totalPages > 1"
            :current-page="page"
            :total-pages="totalPages"
            :has-more="page < totalPages"
            :has-previous="page > 1"
            @next="page++"
            @previous="page--"
          />

          <!-- Load more from server -->
          <div
            v-if="store.waitingOnMe.hasMore && isOnLastPage"
            class="flex items-center justify-center px-4 py-3"
            :class="totalPages > 1 ? 'border-t border-default' : ''"
          >
            <UButton
              :label="t('focus.waitingOnMe.loadMore')"
              icon="i-lucide-chevrons-down"
              variant="ghost"
              size="sm"
              :loading="store.waitingOnMe.loadingMore"
              @click="store.loadMoreWaitingOnMe()"
            />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
