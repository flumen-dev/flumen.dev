<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'repos.detail.title',
})

const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

const {
  repoDetail,
  specialFiles,
  specialFileContent,
  activeTab,
  isViewingFile,
  stats,
  currentPath,
  directoryEntries,
  fileContent,
  browsingFile,
  loading,
  error,
  repoContext,
  loadAll,
  navigateToPath,
  navigateUp,
  exitCodeBrowser,
} = useRepoDetail(owner, repo)

await loadAll()

const githubUrl = computed(() => repoDetail.value?.htmlUrl ?? `https://github.com/${owner.value}/${repo.value}`)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Error state -->
    <UCard
      v-if="error"
      class="mb-4"
    >
      <div class="text-center py-8">
        <UIcon
          name="i-lucide-alert-triangle"
          class="size-8 mb-2 text-rose-500"
        />
        <p class="text-sm text-muted">
          {{ error }}
        </p>
        <UButton
          class="mt-3"
          size="sm"
          @click="loadAll()"
        >
          {{ $t('common.retry') }}
        </UButton>
      </div>
    </UCard>

    <!-- Loading state -->
    <div
      v-else-if="loading"
      class="space-y-4"
    >
      <USkeleton class="h-24 w-full" />
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8 space-y-4">
          <USkeleton class="h-64 w-full" />
          <USkeleton class="h-48 w-full" />
        </div>
        <div class="lg:col-span-4 space-y-4">
          <USkeleton class="h-80 w-full" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="repoDetail">
      <!-- Full-width file viewer when viewing a file -->
      <RepoFileBrowser
        v-if="isViewingFile"
        :current-path="currentPath"
        :entries="directoryEntries"
        :file="fileContent"
        :browsing-file="browsingFile"
        :repo-context="repoContext"
        :github-url="githubUrl"
        :branch="repoDetail.defaultBranch"
        @navigate="navigateToPath"
        @navigate-up="navigateUp"
        @exit="exitCodeBrowser"
      />

      <!-- Two-column overview layout (special files + code directory browser) -->
      <div
        v-else
        class="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        <!-- Left column: Tabs + content -->
        <div class="lg:col-span-8 space-y-6">
          <RepoOverviewTabs
            v-model:active-tab="activeTab"
            :special-file-entries="specialFiles"
            :active-content="specialFileContent"
            :repo-context="repoContext"
            :owner="owner"
            :repo="repo"
            :current-path="currentPath"
            :entries="directoryEntries"
            @navigate="navigateToPath"
            @navigate-up="navigateUp"
          />
        </div>

        <!-- Right sidebar: Header + Stats + Issues/PRs -->
        <aside class="lg:col-span-4 space-y-6">
          <!-- Repository header -->
          <UCard>
            <RepoDetailHeader :repo="repoDetail" />
          </UCard>

          <!-- Health dashboard -->
          <RepoStatistics
            v-if="stats"
            :stats="stats"
          />

          <!-- Issues -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-circle-dot"
                  class="size-4 text-rose-400"
                />
                <span class="text-sm font-medium">
                  {{ $t('repos.detail.recentIssues') }}
                </span>
              </div>
            </template>
            <RepoIssueList
              :owner="owner"
              :repo="repo"
            />
          </UCard>

          <!-- Pull Requests -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-git-pull-request"
                  class="size-4 text-blue-400"
                />
                <span class="text-sm font-medium">
                  {{ $t('repos.detail.recentPrs') }}
                </span>
              </div>
            </template>
            <RepoPrList
              :owner="owner"
              :repo="repo"
            />
          </UCard>
        </aside>
      </div>
    </template>
  </div>
</template>
