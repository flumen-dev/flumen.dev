<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.repos',
})

const { t } = useI18n()
const { user } = useUserSession()
const { orgs } = useUserSettings()

const store = useRepositoryStore()

// Initial fetch
if (store.isStale()) {
  store.fetchRepos()
}

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

// Debounced search
let searchDebounce: ReturnType<typeof setTimeout> | null = null
watch(() => store.search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    store.resetPagination()
    store.fetch()
  }, 300)
})

// Immediate reset on sort/filter/language change
watch([() => store.sort, () => store.filters, () => store.languages], () => {
  store.resetPagination()
  store.fetch()
}, { deep: true })
</script>

<template>
  <div
    v-if="store.errorKey && !store.loading"
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
    <!-- Org switcher (always visible when orgs exist) -->
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

    <!-- Toolbar (always visible so search input stays) -->
    <RepoToolbar
      v-model:search="store.search"
      v-model:sort="store.sort"
      v-model:filters="store.filters"
      v-model:languages="store.languages"
      :count="store.totalCount"
      :available-languages="store.availableLanguages"
    />

    <!-- Loading skeleton (repo list only) -->
    <div
      v-if="store.loading"
      class="rounded-lg border border-default divide-y divide-default overflow-hidden"
    >
      <RepoCardSkeleton
        v-for="n in 6"
        :key="n"
      />
    </div>

    <!-- Content -->
    <template v-else>
      <div
        v-if="store.repos.length"
        class="rounded-lg border border-default divide-y divide-default overflow-hidden"
      >
        <RepoCard
          v-for="repo in store.repos"
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

      <UiPaginator
        :current-page="store.currentPage"
        :total-pages="store.totalPages"
        :has-more="store.hasMore"
        :has-previous="store.hasPrevious"
        :paging="store.paging"
        @next="store.nextPage()"
        @previous="store.prevPage()"
      />
    </template>
  </div>
</template>
