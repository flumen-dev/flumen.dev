<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const { t } = useI18n()
const localePath = useLocalePath()
const store = useIssueStore()

const collapsed = ref<Record<IssueSectionKey, boolean>>(
  ISSUE_SECTIONS.reduce<Record<IssueSectionKey, boolean>>((acc, s) => {
    acc[s.key] = s.defaultCollapsed
    return acc
  }, {} as Record<IssueSectionKey, boolean>),
)

function toggleSection(key: IssueSectionKey) {
  collapsed.value[key] = !collapsed.value[key]
}

// Explicit t() calls so vue-i18n-extract picks up the keys statically.
function sectionLabel(key: IssueSectionKey): string {
  switch (key) {
    case 'needs-response': return t('issues.section.needsResponse')
    case 'fresh-unassigned': return t('issues.section.freshUnassigned')
    case 'in-progress': return t('issues.section.inProgress')
    case 'stale': return t('issues.section.stale')
    case 'other-open': return t('issues.section.otherOpen')
  }
}

async function setFilter(state: 'open' | 'closed') {
  if (store.stateFilter === state) return
  store.stateFilter = state
  await store.fetchIssues()
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Repo selector -->
    <div class="flex items-center gap-2">
      <IssueRepoSelect />
      <RepoStarButton
        v-if="store.selectedRepo"
        :repo="store.selectedRepo"
        show-count
      />
    </div>

    <template v-if="store.selectedRepo">
      <!-- Error -->
      <div
        v-if="store.errorKey"
        class="space-y-3"
      >
        <UAlert
          :title="t(`issues.error.${store.errorKey}.title`)"
          :description="t(`issues.error.${store.errorKey}.description`)"
          :color="store.errorKey === 'rateLimited' ? 'warning' : 'error'"
          :icon="store.errorKey === 'sessionExpired' ? 'i-lucide-log-out' : store.errorKey === 'rateLimited' ? 'i-lucide-clock' : 'i-lucide-alert-triangle'"
        />
        <UButton
          :label="t('common.retry')"
          icon="i-lucide-refresh-cw"
          variant="outline"
          @click="store.refresh()"
        />
      </div>

      <!-- Loading (initial) -->
      <template v-else-if="store.loading && !store.loaded">
        <div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
          <IssueRowSkeleton
            v-for="n in 6"
            :key="n"
          />
        </div>
      </template>

      <!-- Loaded -->
      <template v-else-if="store.loaded">
        <!-- State tabs + Create -->
        <div class="flex items-center gap-4">
          <IssueStateTab
            :label="t('issues.open')"
            icon-key="i-lucide-circle-dot"
            :active="store.stateFilter === 'open'"
            :loading="store.loading"
            :count="store.openCount"
            @select="setFilter('open')"
          />
          <IssueStateTab
            :label="t('issues.closed')"
            icon-key="i-lucide-check-circle"
            :active="store.stateFilter === 'closed'"
            :loading="store.loading"
            :count="store.closedCount"
            @select="setFilter('closed')"
          />
          <div class="ml-auto">
            <UButton
              :label="t('issues.create.button')"
              icon="i-lucide-plus"
              size="sm"
              :to="localePath({ path: '/issues/new', query: { repo: store.selectedRepo } })"
            />
          </div>
        </div>

        <!-- Sections -->
        <div
          class="space-y-3 transition-opacity duration-150"
          :class="store.loading ? 'opacity-50 pointer-events-none' : ''"
        >
          <IssueSection
            v-for="section in ISSUE_SECTIONS"
            :key="section.key"
            :label="sectionLabel(section.key)"
            :icon-key="section.iconKey"
            :icon-class="section.iconClass"
            :count="store.issuesBySection[section.key].length"
            :collapsed="collapsed[section.key]"
            @toggle="toggleSection(section.key)"
          >
            <IssueRow
              v-for="issue in store.issuesBySection[section.key]"
              :key="issue.id"
              :issue="issue"
            />
            <p
              v-if="!store.issuesBySection[section.key].length"
              class="px-4 py-6 text-center text-sm text-muted"
            >
              {{ t('issues.section.empty') }}
            </p>
          </IssueSection>
        </div>

        <!-- Pagination -->
        <UiPaginator
          v-if="store.sortedIssues.length"
          :current-page="store.currentPage"
          :total-pages="store.totalPages"
          :has-more="store.hasMore"
          :has-previous="store.hasPrevious"
          :paging="store.paging"
          @next="store.loadNextPage()"
          @previous="store.loadPreviousPage()"
        />
      </template>
    </template>
  </div>
</template>
