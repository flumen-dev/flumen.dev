<script setup lang="ts">
const { t } = useI18n()
const store = useFocusStore()
</script>

<template>
  <!-- Skeleton loading -->
  <div v-if="store.created.loading && !store.created.data.length">
    <FocusCardSkeleton
      v-for="i in 10"
      :key="i"
    />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="store.created.data.length === 0"
    class="p-6 text-center"
  >
    <UIcon
      name="i-lucide-file-text"
      class="size-8 text-dimmed mx-auto mb-2"
    />
    <p class="text-sm text-muted">
      {{ t('focus.created.empty') }}
    </p>
  </div>

  <!-- Items + pagination -->
  <div v-else>
    <div
      class="transition-opacity duration-200"
      :class="store.createdPaging ? 'opacity-50 pointer-events-none' : ''"
    >
      <FocusCreatedIssueCard
        v-for="item in store.created.data"
        :key="item.id"
        :item="item"
      />
    </div>

    <UiPaginator
      :current-page="store.createdPage"
      :total-pages="store.createdTotalPages"
      :has-more="store.createdHasMore"
      :has-previous="store.createdHasPrevious"
      :paging="store.createdPaging"
      @next="store.createdNextPage()"
      @previous="store.createdPrevPage()"
    />
  </div>
</template>
