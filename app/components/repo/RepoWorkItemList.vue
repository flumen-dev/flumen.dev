<script setup lang="ts">
import type { WorkItem } from '~~/shared/types/work-item'

const props = defineProps<{
  owner: string
  repo: string
  limit?: number
  state?: 'open' | 'closed' | 'all'
  linkMode?: 'external' | 'repo'
}>()

const resolvedLimit = computed(() => props.limit ?? 5)
const resolvedState = computed(() => props.state ?? 'open')
const resolvedLinkMode = computed(() => props.linkMode ?? 'external')
const { t } = useI18n()

const { data: workItems, status, error: fetchError } = useLazyFetch<WorkItem[]>(
  `/api/repository/${props.owner}/${props.repo}/work-items`,
  {
    query: {
      limit: resolvedLimit,
      state: resolvedState,
    },
  },
)

const router = useRouter()
const localePath = useLocalePath()

function navigateToItem(item: WorkItem) {
  if (resolvedLinkMode.value === 'repo') {
    router.push(localePath(`/repos/${props.owner}/${props.repo}/work-items/${item.id}`))
  }
  else {
    window.open(item.htmlUrl, '_blank', 'noopener,noreferrer')
  }
}

const STATE_COLOR: Record<string, string> = {
  OPEN: 'success',
  CLOSED: 'neutral',
  MERGED: 'primary',
  DRAFT: 'neutral',
}

function stateBadgeColor(state: string) {
  return STATE_COLOR[state] ?? 'neutral'
}

function stateBadgeLabel(item: WorkItem) {
  if (item.type === 'pull' && item.isDraft) return t('repos.workItem.state.draft')
  if (item.state === 'MERGED') return t('repos.workItem.state.merged')
  if (item.state === 'CLOSED') return t('repos.workItem.state.closed')
  return t('repos.workItem.state.open')
}

function prStatusLabel(item: WorkItem) {
  if (item.type === 'pull') {
    if (item.isDraft) return t('repos.workItem.status.draft')
    if (item.state === 'MERGED') return t('repos.workItem.status.merged')
    if (item.reviewDecision === 'APPROVED') return t('repos.workItem.status.approved')
    if (item.reviewDecision === 'CHANGES_REQUESTED') return t('repos.workItem.status.changesRequested')
    if (item.reviewDecision === 'REVIEW_REQUIRED') return t('repos.workItem.status.reviewRequested')
    if (item.state === 'CLOSED') return t('repos.workItem.status.closed')
    return t('repos.workItem.status.open')
  }

  if (!item.linkedPulls.length) return null
  if (item.reviewDecision === 'APPROVED') return t('repos.workItem.status.prApproved')
  if (item.reviewDecision === 'CHANGES_REQUESTED') return t('repos.workItem.status.prChangesRequested')
  if (item.reviewDecision === 'REVIEW_REQUIRED') return t('repos.workItem.status.prReviewRequested')
  return t('repos.workItem.status.prLinked')
}

function ciIcon(ciStatus: WorkItem['ciStatus']) {
  return getCIIcon(ciStatus)
}
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-default text-xs font-medium text-primary">
      <UIcon
        name="i-lucide-layers"
        class="size-3.5"
      />
      {{ $t('repos.detail.workItems') }}
    </div>

    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <template v-else-if="workItems?.length">
      <div
        v-for="item in workItems"
        :key="item.id"
        role="link"
        tabindex="0"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-primary hover:pl-2.5 transition-all border-b border-default last:border-b-0 cursor-pointer"
        @click="navigateToItem(item)"
        @keydown.enter="navigateToItem(item)"
        @keydown.space.prevent="navigateToItem(item)"
      >
        <RepoWorkItemRow
          :item="item"
          :repo="`${owner}/${repo}`"
          :state-badge-color="stateBadgeColor(item.state)"
          :state-badge-label="stateBadgeLabel(item)"
          :pr-status-label="prStatusLabel(item)"
          :ci-icon="ciIcon(item.ciStatus)"
        />
      </div>
    </template>

    <div
      v-else-if="fetchError"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.error.fetchError.title') }}
    </div>

    <div
      v-else
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.noResults') }}
    </div>
  </div>
</template>
