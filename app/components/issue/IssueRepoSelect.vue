<script setup lang="ts">
const { t } = useI18n()
const repoStore = useRepositoryStore()
const issueStore = useIssueStore()
const { settings, update } = useUserSettings()

const open = ref(false)

const reposWithCounts = computed(() =>
  repoStore.repos
    .filter(r => !r.archived)
    .map(r => ({
      ...r,
      openIssues: repoStore.issueCounts[r.fullName] ?? 0,
      openPrs: repoStore.prCounts[r.fullName] ?? 0,
    }))
    .sort((a, b) => b.openIssues - a.openIssues),
)

const selectedRepoData = computed(() =>
  reposWithCounts.value.find(r => r.fullName === issueStore.selectedRepo),
)

async function select(fullName: string) {
  open.value = false
  await issueStore.selectRepo(fullName)
  update({ selectedRepo: fullName })
}

// Restore from settings on mount
onMounted(async () => {
  await repoStore.fetchAll()
  const saved = settings.value?.selectedRepo
  if (saved && repoStore.repos.some(r => r.fullName === saved)) {
    await issueStore.selectRepo(saved)
  }
})
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'bottom', align: 'start' }"
  >
    <UButton
      variant="outline"
      color="neutral"
      class="w-full justify-between"
      trailing-icon="i-lucide-chevrons-up-down"
    >
      <template v-if="selectedRepoData">
        <div class="truncate flex justify-center font-medium">
          <span>{{ selectedRepoData.name }}</span>

          <UBadge
            v-if="selectedRepoData.openIssues"
            color="error"
            variant="subtle"
            size="xs"
            class="ml-2 gap-1"
          >
            <UIcon
              name="i-lucide-circle-dot"
              class="size-3"
            />
            {{ selectedRepoData.openIssues }}
          </UBadge>
        </div>
      </template>
      <span
        v-else
        class="text-muted"
      >{{ t('issues.selectRepo') }}</span>
    </UButton>

    <template #content>
      <div class="w-96 overflow-y-auto max-h-96">
        <button
          v-for="repo in reposWithCounts"
          :key="repo.id"
          class="w-full text-left px-3 py-2.5 hover:bg-elevated transition-colors flex items-start gap-3 cursor-pointer"
          :class="{ 'bg-elevated/50': repo.fullName === issueStore.selectedRepo }"
          @click="select(repo.fullName)"
        >
          <UIcon
            :name="repo.fullName === issueStore.selectedRepo ? 'i-lucide-check' : 'i-lucide-book-marked'"
            class="size-4 mt-0.5 shrink-0"
            :class="repo.fullName === issueStore.selectedRepo ? 'text-primary' : 'text-muted'"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate">{{ repo.name }}</span>
              <UBadge
                v-if="repo.visibility === 'private'"
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ t('repos.badge.private') }}
              </UBadge>
            </div>
            <p
              v-if="repo.description"
              class="text-xs text-muted truncate mt-0.5"
            >
              {{ repo.description }}
            </p>
            <div class="flex items-center gap-3 mt-1">
              <span
                v-if="repo.openIssues"
                class="inline-flex items-center gap-1 text-xs text-rose-500"
              >
                <UIcon
                  name="i-lucide-circle-dot"
                  class="size-3.5"
                />
                {{ t('issues.openCount', { count: repo.openIssues }) }}
              </span>
              <span
                v-if="repo.openPrs"
                class="inline-flex items-center gap-1 text-xs text-blue-500"
              >
                <UIcon
                  name="i-lucide-git-pull-request"
                  class="size-3.5"
                />
                {{ repo.openPrs }}
              </span>
              <span
                v-if="repo.language"
                class="text-xs text-dimmed"
              >
                {{ repo.language }}
              </span>
            </div>
          </div>
        </button>

        <p
          v-if="!reposWithCounts.length"
          class="px-3 py-4 text-sm text-muted text-center"
        >
          {{ t('repos.noResults') }}
        </p>
      </div>
    </template>
  </UPopover>
</template>
