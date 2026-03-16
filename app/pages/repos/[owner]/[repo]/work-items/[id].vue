<script lang="ts" setup>
import type { WorkItemDetail } from '~~/shared/types/work-item'

definePageMeta({
  middleware: 'auth',
  titleKey: 'repos.detail.workItems',
})

const route = useRoute()
const { t } = useI18n()
const hasTeleportContent = useState('has-page-title-teleport', () => true)

onMounted(() => {
  hasTeleportContent.value = true
})

onUnmounted(() => {
  hasTeleportContent.value = false
})

const owner = computed(() => route.params.owner as string)
const repoName = computed(() => route.params.repo as string)
const id = computed(() => route.params.id as string)
const repo = computed(() => `${owner.value}/${repoName.value}`)
const requestFetch = useRequestFetch()

const { data: workItem, status: workItemStatus, error: workItemError } = await useAsyncData(
  () => `work-item-detail-${owner.value}-${repoName.value}-${id.value}`,
  () => requestFetch<WorkItemDetail>(`/api/repository/${owner.value}/${repoName.value}/work-items/${id.value}`),
  {
    watch: [owner, repoName, id],
  },
)

const workItemUrl = computed(() => `/api/repository/${owner.value}/${repoName.value}/work-items/${id.value}`)
const { trigger: triggerPolling } = useWorkItemPolling(workItem, workItemUrl)

const number = computed(() => {
  if (workItem.value?.number) return workItem.value.number
  const parsed = Number.parseInt(id.value.replace(/^pr-/, ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return parsed
})

// --- Track recent ---

const recentStore = useRecentStore()
watch(workItem, (val) => {
  if (!val) return
  recentStore.track({
    type: val.primaryType === 'issue' ? 'issue' : 'pr',
    repo: repo.value,
    number: val.number,
    title: val.title,
    url: val.htmlUrl,
  })
}, { immediate: true })

// --- Tabs ---

const hasPr = computed(() => {
  if (!workItem.value) return false
  return workItem.value.primaryType === 'pull' || workItem.value.contributions.length > 0
})

const activePullNumber = computed(() => {
  if (!workItem.value) return undefined
  if (workItem.value.primaryType === 'pull') return workItem.value.number
  return workItem.value.contributions[0]?.number
})

const activePullHeadSha = computed(() => {
  if (!workItem.value) return undefined
  if (workItem.value.primaryType === 'pull') return workItem.value.headSha
  return workItem.value.contributions[0]?.headSha
})

provide('workItemRef', workItem)
provide('hasPr', hasPr)

const activeTab = ref('conversation')

watch([id, hasPr], () => {
  if (!hasPr.value && activeTab.value !== 'conversation') {
    activeTab.value = 'conversation'
  }
})

const tabItems = computed(() => {
  const items = [
    { label: t('workItems.tabs.conversation'), value: 'conversation', icon: 'i-lucide-message-square' },
  ]
  if (hasPr.value) {
    items.push({ label: t('workItems.tabs.changes'), value: 'changes', icon: 'i-lucide-file-diff' })
  }
  return items
})
</script>

<template>
  <div>
    <Teleport to="#page-title-teleport">
      <div class="flex items-center gap-2">
        <NuxtLinkLocale
          :to="`/repos/${owner}/${repoName}/work-items`"
          class="text-sm font-semibold text-highlighted hover:text-primary transition-colors truncate"
        >
          {{ repo }}
        </NuxtLinkLocale>
        <span class="font-mono text-sm text-muted">#{{ number }}</span>
        <RepoStarButton
          :repo="repo"
          show-count
        />
      </div>
    </Teleport>

    <WorkItemHeader
      v-if="workItem"
      :work-item="workItem"
      :repo="repo"
      @ci-status-changed="triggerPolling"
      @merged="triggerPolling"
      @reviewed="triggerPolling"
    />

    <div class="p-4">
      <div
        v-if="workItemStatus === 'pending'"
        class="py-8 text-center text-muted"
      >
        {{ $t('common.loading') }}
      </div>

      <div
        v-else-if="workItemError"
        class="py-8 text-center text-muted"
      >
        {{ workItemError.message }}
      </div>

      <template v-else-if="workItem">
        <!-- Tabs (only when PR exists) -->
        <UTabs
          v-if="hasPr"
          v-model="activeTab"
          :items="tabItems"
          class="mb-4"
        />

        <WorkItemConversation
          v-show="activeTab === 'conversation'"
          :id="id"
          :owner="owner"
          :repo-name="repoName"
        />

        <WorkItemChanges
          v-if="hasPr && activeTab === 'changes' && activePullNumber"
          :owner="owner"
          :repo="repoName"
          :pull-number="activePullNumber"
          :head-sha="activePullHeadSha"
        />
      </template>
    </div>
  </div>
</template>
