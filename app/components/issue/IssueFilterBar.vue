<script setup lang="ts">
const { t } = useI18n()
const store = useIssueStore()
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

const filterChips = computed(() => [
  { key: 'assignedToMe', label: t('issues.filter.assignedToMe'), icon: 'i-lucide-user-check' },
  { key: 'unassigned', label: t('issues.filter.unassigned'), icon: 'i-lucide-user-x' },
  { key: 'hasMilestone', label: t('issues.filter.hasMilestone'), icon: 'i-lucide-milestone' },
])

interface PersonStat {
  login: string
  avatarUrl: string
  count: number
}

function tally(getPeople: (issue: { author: { login: string, avatarUrl: string }, assignees: { login: string, avatarUrl: string }[] }) => Array<{ login: string, avatarUrl: string }>): PersonStat[] {
  const counts = new Map<string, PersonStat>()
  for (const issue of store.issues) {
    for (const person of getPeople(issue)) {
      const existing = counts.get(person.login)
      if (existing) existing.count++
      else counts.set(person.login, { login: person.login, avatarUrl: person.avatarUrl, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

// Prefer the repo-wide people pool (sampled across all issues, server-cached).
// Fall back to in-view-derived counts if the pool fetch is still loading or empty.
const authors = computed(() => store.repoAuthors.length ? store.repoAuthors : tally(issue => [issue.author]))
const assignees = computed(() => store.repoAssignees.length ? store.repoAssignees : tally(issue => issue.assignees))

// `/` focuses the search input — GitHub-style. Skip when typing in any input.
onKeyStroke('/', (e) => {
  const target = e.target as HTMLElement | null
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
  e.preventDefault()
  inputRef.value?.focus()
})
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <!-- Search row -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <UIcon
          name="i-lucide-search"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none"
        />
        <input
          ref="inputRef"
          v-model="store.search"
          type="text"
          :placeholder="t('issues.search')"
          :aria-label="t('issues.search')"
          class="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-elevated/50 border border-default focus:outline-none focus:border-primary placeholder-muted transition-colors"
        >
        <kbd
          v-if="!store.search"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted bg-default px-1.5 py-0.5 rounded border border-default pointer-events-none"
        >/</kbd>
      </div>
      <UButton
        v-if="store.hasActiveFilters"
        :label="t('issues.filter.clear')"
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="store.clearFilters()"
      />
    </div>

    <!-- Filter chips -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <button
        v-for="chip in filterChips"
        :key="chip.key"
        type="button"
        :aria-pressed="store.activeFilters.includes(chip.key)"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
        :class="store.activeFilters.includes(chip.key)
          ? 'bg-primary text-inverted'
          : 'bg-muted text-toned hover:bg-accented'"
        @click="store.toggleFilter(chip.key)"
      >
        <UIcon
          :name="chip.icon"
          class="size-3.5"
        />
        {{ chip.label }}
      </button>

      <IssueUserPicker
        filter-prefix="author"
        :people="authors"
        :placeholder="t('issues.filter.author')"
      />
      <IssueUserPicker
        filter-prefix="assignee"
        :people="assignees"
        :placeholder="t('issues.filter.assignee')"
      />

      <!-- Label chips (when available) -->
      <div
        v-if="store.availableLabels.length"
        class="flex items-center gap-1 flex-wrap ml-auto"
      >
        <button
          v-for="label in store.availableLabels"
          :key="label"
          type="button"
          :aria-pressed="store.activeFilters.includes(`label:${label}`)"
          class="inline-flex items-center px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer"
          :class="store.activeFilters.includes(`label:${label}`)
            ? 'bg-primary text-inverted'
            : 'bg-muted text-toned hover:bg-accented'"
          @click="store.toggleFilter(`label:${label}`)"
        >
          {{ label }}
        </button>
      </div>
    </div>
  </div>
</template>
