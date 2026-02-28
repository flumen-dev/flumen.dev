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

const localePath = useLocalePath()

function workItemTo(item: WorkItem) {
  return localePath(`/repos/${props.owner}/${props.repo}/work-items/${item.id}`)
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
      <component
        :is="resolvedLinkMode === 'repo' ? 'NuxtLink' : 'a'"
        v-for="item in workItems"
        :key="item.id"
        v-bind="resolvedLinkMode === 'repo'
          ? { to: workItemTo(item) }
          : { href: item.htmlUrl, target: '_blank', rel: 'noopener noreferrer' }"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-primary hover:pl-2.5 transition-all border-b border-default last:border-b-0"
      >
        <RepoWorkItemRow
          :item="item"
          :state-badge-color="stateBadgeColor(item.state)"
          :state-badge-label="stateBadgeLabel(item)"
          :pr-status-label="prStatusLabel(item)"
          :ci-icon="ciIcon(item.ciStatus)"
        />
      </component>
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
