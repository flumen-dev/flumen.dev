<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.repos',
})

const { t } = useI18n()
const { user } = useUserSession()
const { orgs } = useUserSettings()

const store = useRepositoryStore()
await store.fetchAll()

const search = ref('')
const sort = ref('pushed')
const filters = ref<string[]>([])
const languages = ref<string[]>([])

const orgItems = computed(() => [
  { label: user.value?.login ?? t('repos.myRepos'), value: '', avatar: { src: user.value?.avatarUrl, alt: user.value?.login } },
  ...orgs.value.map(org => ({ label: org.login, value: org.login, avatar: { src: org.avatarUrl, alt: org.login } })),
])

const selectedOrgValue = computed(() => store.selectedOrg ?? '')

async function handleOrgChange(orgValue: string) {
  const org = orgValue || null
  if (org === store.selectedOrg) return
  await store.selectOrg(org)
}

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
  <!-- Loading skeleton -->
  <div
    v-if="store.loading"
    class="p-4 space-y-4"
  >
    <!-- Org switcher skeleton -->
    <div
      v-if="orgs.length"
      class="flex items-center gap-2"
    >
      <USkeleton
        v-for="n in Math.min(orgs.length + 1, 5)"
        :key="n"
        class="h-8 w-24 rounded-md"
      />
    </div>

    <!-- Toolbar skeleton -->
    <div class="flex items-center gap-3">
      <USkeleton class="h-9 flex-1 rounded-md" />
      <USkeleton class="h-4 w-24 rounded" />
    </div>
    <div class="flex items-center gap-2">
      <USkeleton
        v-for="n in 5"
        :key="n"
        class="h-7 w-16 rounded-md"
      />
      <USkeleton class="ml-auto h-7 w-28 rounded-md" />
    </div>

    <!-- Repo cards skeleton -->
    <div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
      <RepoCardSkeleton
        v-for="n in 6"
        :key="n"
      />
    </div>
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
    v-else
    class="p-4 space-y-4"
  >
    <!-- Org switcher -->
    <div
      v-if="orgs.length"
      class="flex items-center gap-2"
    >
      <button
        v-for="item in orgItems"
        :key="item.value"
        :aria-pressed="selectedOrgValue === item.value"
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        :class="selectedOrgValue === item.value
          ? 'bg-primary text-inverted'
          : 'bg-muted text-toned hover:bg-accented'"
        @click="handleOrgChange(item.value)"
      >
        <UAvatar
          :src="item.avatar.src"
          :alt="item.avatar.alt"
          size="3xs"
        />
        {{ item.label }}
      </button>
    </div>

    <template v-if="store.repos.length">
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
    </template>

    <p
      v-else
      class="text-sm text-muted"
    >
      {{ $t('repos.noResults') }}
    </p>
  </div>
</template>
