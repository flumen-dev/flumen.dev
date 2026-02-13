<script setup lang="ts">
const { t } = useI18n()
const store = useIssueStore()

function toggleFilter(key: string) {
  const current = store.activeFilters
  if (current.includes(key)) {
    store.activeFilters = current.filter(f => f !== key)
  }
  else {
    store.activeFilters = [...current, key]
  }
}

const filterChips = computed(() => [
  { key: 'unassigned', label: t('issues.filter.unassigned'), icon: 'i-lucide-user-x' },
  { key: 'hasLinkedPr', label: t('issues.filter.hasLinkedPr'), icon: 'i-lucide-git-pull-request', color: 'text-blue-500' },
  { key: 'noLinkedPr', label: t('issues.filter.noLinkedPr'), icon: 'i-lucide-git-pull-request-closed', color: 'text-rose-500' },
  { key: 'hasMilestone', label: t('issues.filter.hasMilestone'), icon: 'i-lucide-milestone' },
])

const sortOptions = computed(() => [
  { label: t('issues.sort.critical'), value: 'critical' },
  { label: t('issues.sort.newest'), value: 'newest' },
  { label: t('issues.sort.oldest'), value: 'oldest' },
  { label: t('issues.sort.mostCommented'), value: 'mostCommented' },
  { label: t('issues.sort.leastCommented'), value: 'leastCommented' },
  { label: t('issues.sort.recentlyUpdated'), value: 'recentlyUpdated' },
])
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Row 1: Search + count -->
    <div class="flex items-center gap-3">
      <UInput
        v-model="store.search"
        :placeholder="t('issues.search')"
        icon="i-lucide-search"
        class="flex-1"
      />
      <span class="text-sm text-muted shrink-0">
        {{ t('issues.count', store.filteredIssues.length) }}
      </span>
    </div>

    <!-- Row 2: Filter chips + sort -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="chip in filterChips"
        :key="chip.key"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
        :class="store.activeFilters.includes(chip.key)
          ? (chip.color ? `bg-muted ${chip.color} ring-1 ring-current/20` : 'bg-primary text-inverted')
          : 'bg-muted text-toned hover:bg-accented'"
        @click="toggleFilter(chip.key)"
      >
        <UIcon
          :name="chip.icon"
          class="size-3.5"
        />
        {{ chip.label }}
      </button>

      <div class="ml-auto">
        <USelect
          v-model="store.sortKey"
          :items="sortOptions"
          size="xs"
        />
      </div>
    </div>

    <!-- Row 3: Label chips -->
    <div
      v-if="store.availableLabels.length"
      class="flex items-center gap-1.5 flex-wrap"
    >
      <button
        v-for="label in store.availableLabels"
        :key="label"
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer"
        :class="store.activeFilters.includes(`label:${label}`)
          ? 'bg-primary text-inverted'
          : 'bg-muted text-toned hover:bg-accented'"
        @click="toggleFilter(`label:${label}`)"
      >
        {{ label }}
      </button>
    </div>
  </div>
</template>
