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

const localePath = useLocalePath()
const repoBase = computed(() => `/repos/${owner.value}/${repo.value}`)
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Error state -->
    <UCard
      v-if="error"
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
    >
      <USkeleton class="h-36 w-full" />
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-4">
          <USkeleton class="h-64 w-full" />
          <USkeleton class="h-48 w-full" />
        </div>
        <div class="space-y-4">
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

      <template v-else>
        <!-- Hero header — full width -->
        <UCard>
          <RepoDetailHeader
            :repo="repoDetail"
            :stats="stats"
          />
        </UCard>

        <!-- Two-column layout: Content + Sidebar -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Main content area -->
          <div class="lg:col-span-2 space-y-6">
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

          <!-- Sidebar -->
          <aside class="space-y-6">
            <!-- Stats / About / Contributors / Activity (client-only to avoid hydration mismatch) -->
            <ClientOnly>
              <RepoStatistics
                v-if="stats"
                :stats="stats"
                :default-branch="repoDetail.defaultBranch"
              />
            </ClientOnly>

            <!-- Navigation -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-lucide-list"
                    class="size-4 text-primary"
                  />
                  <span class="text-sm font-medium">
                    {{ $t('repos.detail.lists') }}
                  </span>
                </div>
              </template>

              <p class="text-xs text-dimmed mb-3">
                {{ $t('repos.detail.workItemsHint') }}
              </p>
              <div class="grid grid-cols-1 gap-2">
                <UButton
                  block
                  variant="outline"
                  icon="i-lucide-layers"
                  :to="localePath(`${repoBase}/work-items`)"
                >
                  {{ $t('repos.detail.workItems') }}
                </UButton>
                <UButton
                  block
                  variant="soft"
                  color="error"
                  icon="i-lucide-circle-dot"
                  :to="localePath(`${repoBase}/issues`)"
                >
                  {{ $t('nav.issues') }}
                </UButton>
              </div>
            </UCard>

            <!-- Recent Work Items -->
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-lucide-layers"
                    class="size-4 text-primary"
                  />
                  <span class="text-sm font-medium">
                    {{ $t('repos.detail.workItems') }}
                  </span>
                </div>
              </template>
              <RepoWorkItemList
                :owner="owner"
                :repo="repo"
                link-mode="repo"
              />
            </UCard>
          </aside>
        </div>
      </template>
    </template>
  </div>
</template>
