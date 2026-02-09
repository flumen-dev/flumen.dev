<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.repos',
})

const { data: repos, status } = await useFetch('/api/repository')

// Lazy-loaded — don't block repo list
const { data: activity } = useLazyFetch('/api/repository/activity')
const { data: pullCounts } = useLazyFetch<Record<string, number>>('/api/repository/pulls')
const { data: issueCounts } = useLazyFetch<Record<string, number>>('/api/repository/issues')
const { data: notificationCounts } = useLazyFetch<Record<string, number>>('/api/repository/notifications')

const search = ref('')
const sort = ref('pushed')
const filters = ref<string[]>([])
const languages = ref<string[]>([])

const availableLanguages = computed(() => {
  if (!repos.value) return []
  const set = new Set(repos.value.map(r => r.language).filter(Boolean) as string[])
  return [...set].sort()
})

const activityFilterKeys = ['hasIssues', 'hasPrs', 'hasNotifications']

const filteredRepos = computed(() => {
  if (!repos.value) return []

  let result = repos.value

  // Search
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(r =>
      r.name.toLowerCase().includes(q)
      || r.description?.toLowerCase().includes(q)
      || r.topics.some(t => t.toLowerCase().includes(q)),
    )
  }

  // Type filters (OR — each active filter includes matching repos)
  const typeFilters = filters.value.filter(f => !activityFilterKeys.includes(f))
  if (typeFilters.length) {
    result = result.filter((r) => {
      if (typeFilters.includes('public') && r.visibility === 'public') return true
      if (typeFilters.includes('private') && r.visibility === 'private') return true
      if (typeFilters.includes('forks') && r.fork) return true
      if (typeFilters.includes('templates') && r.isTemplate) return true
      if (typeFilters.includes('archived') && r.archived) return true
      return false
    })
  }
  else {
    // No type filters active — hide archived by default
    result = result.filter(r => !r.archived)
  }

  // Activity filters (AND — each narrows the result)
  if (filters.value.includes('hasIssues')) {
    result = result.filter(r => issueCounts.value?.[r.fullName])
  }
  if (filters.value.includes('hasPrs')) {
    result = result.filter(r => pullCounts.value?.[r.fullName])
  }
  if (filters.value.includes('hasNotifications')) {
    result = result.filter(r => notificationCounts.value?.[r.fullName])
  }

  // Languages (additive)
  if (languages.value.length) {
    result = result.filter(r => r.language && languages.value.includes(r.language))
  }

  // Sort
  const s = sort.value
  if (s === 'stars') {
    result = [...result].sort((a, b) => b.stargazersCount - a.stargazersCount)
  }
  else if (s === 'name') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name))
  }
  else if (s === 'issues') {
    result = [...result].sort((a, b) => (issueCounts.value?.[b.fullName] ?? 0) - (issueCounts.value?.[a.fullName] ?? 0))
  }
  else if (s === 'prs') {
    result = [...result].sort((a, b) => (pullCounts.value?.[b.fullName] ?? 0) - (pullCounts.value?.[a.fullName] ?? 0))
  }
  else if (s === 'notifications') {
    result = [...result].sort((a, b) => (notificationCounts.value?.[b.fullName] ?? 0) - (notificationCounts.value?.[a.fullName] ?? 0))
  }

  return result
})
</script>

<template>
  <div
    v-if="status === 'pending'"
    class="p-4"
  >
    {{ $t('common.loading') }}
  </div>

  <div
    v-else-if="repos?.length"
    class="p-4 space-y-4"
  >
    <RepoToolbar
      v-model:search="search"
      v-model:sort="sort"
      v-model:filters="filters"
      v-model:languages="languages"
      :count="filteredRepos.length"
      :available-languages="availableLanguages"
    />

    <div
      v-if="filteredRepos.length"
      class="rounded-lg border border-default divide-y divide-default overflow-hidden"
    >
      <RepoCard
        v-for="repo in filteredRepos"
        :key="repo.id"
        :repo="repo"
        :activity="activity?.[repo.fullName]?.weeks"
        :open-prs="pullCounts?.[repo.fullName]"
        :open-issues="issueCounts?.[repo.fullName]"
        :notifications="notificationCounts?.[repo.fullName]"
      />
    </div>

    <p
      v-else
      class="text-sm text-muted"
    >
      {{ $t('repos.noResults') }}
    </p>
  </div>

  <div
    v-else
    class="p-4 text-muted"
  >
    {{ $t('repos.noResults') }}
  </div>
</template>
