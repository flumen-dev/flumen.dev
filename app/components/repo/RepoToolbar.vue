<script setup lang="ts">
const { t } = useI18n()

const search = defineModel<string>('search', { default: '' })
const sort = defineModel<string>('sort', { default: 'pushed' })
const filters = defineModel<string[]>('filters', { default: () => [] })
const languages = defineModel<string[]>('languages', { default: () => [] })

defineProps<{
  count: number
  availableLanguages: string[]
}>()

function toggleFilter(key: string) {
  const current = filters.value
  if (current.includes(key)) {
    filters.value = current.filter(f => f !== key)
  }
  else {
    filters.value = [...current, key]
  }
}

function toggleLanguage(lang: string) {
  const current = languages.value
  if (current.includes(lang)) {
    languages.value = current.filter(l => l !== lang)
  }
  else {
    languages.value = [...current, lang]
  }
}

const typeChips = computed(() => [
  { key: 'public', label: t('repos.filter.public'), icon: 'i-lucide-globe' },
  { key: 'private', label: t('repos.filter.private'), icon: 'i-lucide-lock' },
  { key: 'forks', label: t('repos.filter.forks'), icon: 'i-lucide-git-fork' },
  { key: 'templates', label: t('repos.filter.templates'), icon: 'i-lucide-copy' },
  { key: 'archived', label: t('repos.filter.archived'), icon: 'i-lucide-archive' },
])

const activityChips = computed(() => [
  { key: 'hasIssues', label: t('repos.filter.hasIssues'), icon: 'i-lucide-circle-dot', color: 'text-rose-500' },
  { key: 'hasPrs', label: t('repos.filter.hasPrs'), icon: 'i-lucide-git-pull-request', color: 'text-blue-500' },
  { key: 'hasNotifications', label: t('repos.filter.hasNotifications'), icon: 'i-lucide-bell', color: 'text-amber-400' },
])

const sortOptions = computed(() => [
  { label: t('repos.sort.pushed'), value: 'pushed' },
  { label: t('repos.sort.stars'), value: 'stars' },
  { label: t('repos.sort.name'), value: 'name' },
  { label: t('repos.sort.issues'), value: 'issues' },
  { label: t('repos.sort.prs'), value: 'prs' },
  { label: t('repos.sort.notifications'), value: 'notifications' },
])
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Row 1: Search + count -->
    <div class="flex items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="$t('repos.search')"
        icon="i-lucide-search"
        class="flex-1"
      />
      <span class="text-sm text-muted shrink-0">
        {{ $t('repos.count', count) }}
      </span>
    </div>

    <!-- Row 2: Type filter chips + activity chips + sort -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="chip in typeChips"
        :key="chip.key"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
        :class="filters.includes(chip.key)
          ? 'bg-primary text-inverted'
          : 'bg-muted text-toned hover:bg-accented'"
        @click="toggleFilter(chip.key)"
      >
        <UIcon
          :name="chip.icon"
          class="size-3.5"
        />
        {{ chip.label }}
      </button>

      <span class="w-px h-5 bg-default" />

      <button
        v-for="chip in activityChips"
        :key="chip.key"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
        :class="filters.includes(chip.key)
          ? `bg-muted ${chip.color} ring-1 ring-current/20`
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
          v-model="sort"
          :items="sortOptions"
          size="xs"
        />
      </div>
    </div>

    <!-- Row 3: Language chips (only if languages exist) -->
    <div
      v-if="availableLanguages.length"
      class="flex items-center gap-1.5 flex-wrap"
    >
      <button
        v-for="lang in availableLanguages"
        :key="lang"
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer"
        :class="languages.includes(lang)
          ? 'bg-primary text-inverted'
          : 'bg-muted text-toned hover:bg-accented'"
        @click="toggleLanguage(lang)"
      >
        <span
          class="size-2 rounded-full shrink-0"
          :style="{ backgroundColor: getLanguageColor(lang) }"
        />
        {{ lang }}
      </button>
    </div>
  </div>
</template>
