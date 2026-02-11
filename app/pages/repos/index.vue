<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.repos',
})

const store = useRepositoryStore()
await store.fetchAll()

const search = ref('')
const sort = ref('pushed')
const filters = ref<string[]>([])
const languages = ref<string[]>([])

const availableLanguages = computed(() => {
  if (!store.repos.length) return []
  const set = new Set(store.repos.map(r => r.language).filter(Boolean) as string[])
  return [...set].sort()
})

const activityFilterKeys = ['hasIssues', 'hasPrs', 'hasNotifications']

const filteredRepos = computed(() => {
  if (!store.repos.length) return []

  let result = store.repos

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
    result = result.filter(r => store.issueCounts[r.fullName])
  }
  if (filters.value.includes('hasPrs')) {
    result = result.filter(r => store.prCounts[r.fullName])
  }
  if (filters.value.includes('hasNotifications')) {
    result = result.filter(r => store.notificationCounts[r.fullName])
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
    result = [...result].sort((a, b) => (store.issueCounts[b.fullName] ?? 0) - (store.issueCounts[a.fullName] ?? 0))
  }
  else if (s === 'prs') {
    result = [...result].sort((a, b) => (store.prCounts[b.fullName] ?? 0) - (store.prCounts[a.fullName] ?? 0))
  }
  else if (s === 'notifications') {
    result = [...result].sort((a, b) => (store.notificationCounts[b.fullName] ?? 0) - (store.notificationCounts[a.fullName] ?? 0))
  }

  return result
})
</script>

<template>
  <div
    v-if="store.loading"
    class="p-4"
  >
    {{ $t('common.loading') }}
  </div>

  <div
    v-else-if="store.errorKey"
    class="p-4 space-y-3"
  >
    <UAlert
      :title="$t(`repos.error.${store.errorKey}.title`)"
      :description="$t(`repos.error.${store.errorKey}.description`)"
      :color="store.errorKey === 'rateLimited' ? 'warning' : 'error'"
      :icon="store.errorKey === 'sessionExpired' ? 'i-lucide-log-out' : store.errorKey === 'rateLimited' ? 'i-lucide-clock' : 'i-lucide-alert-triangle'"
    />
    <UButton
      :label="$t('common.retry')"
      icon="i-lucide-refresh-cw"
      variant="outline"
      @click="store.refresh()"
    />
  </div>

  <div
    v-else-if="store.repos.length"
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
        :activity="store.activity[repo.fullName]?.weeks"
        :open-prs="store.prCounts[repo.fullName]"
        :open-issues="store.issueCounts[repo.fullName]"
        :notifications="store.notificationCounts[repo.fullName]"
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
