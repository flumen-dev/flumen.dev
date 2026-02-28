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

const { data: workItems, status } = useLazyFetch<WorkItem[]>(
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
  if (ciStatus === 'SUCCESS') return { name: 'i-lucide-circle-check', class: 'text-emerald-500' }
  if (ciStatus === 'FAILURE') return { name: 'i-lucide-circle-x', class: 'text-red-500' }
  if (ciStatus === 'PENDING') return { name: 'i-lucide-loader-2', class: 'text-amber-400 animate-spin' }
  return null
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
      <template v-if="resolvedLinkMode === 'repo'">
        <NuxtLink
          v-for="item in workItems"
          :key="`repo-${item.id}`"
          :to="workItemTo(item)"
          class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-primary hover:pl-2.5 transition-all border-b border-default last:border-b-0"
        >
          <UIcon
            :name="item.type === 'issue' ? 'i-lucide-circle-dot' : (item.isDraft ? 'i-lucide-git-pull-request-draft' : 'i-lucide-git-pull-request')"
            class="size-4 shrink-0 mt-0.5"
            :class="item.type === 'issue' ? 'text-rose-500' : 'text-blue-500'"
          />

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-highlighted truncate">
                {{ item.title }}
              </span>
              <span class="text-xs text-dimmed shrink-0 font-mono">
                #{{ item.number }}
              </span>
              <UBadge
                size="xs"
                variant="subtle"
                :color="stateBadgeColor(item.state) as any"
              >
                {{ stateBadgeLabel(item) }}
              </UBadge>
              <UBadge
                v-if="prStatusLabel(item)"
                size="xs"
                color="primary"
                variant="subtle"
              >
                {{ prStatusLabel(item) }}
              </UBadge>
              <UIcon
                v-if="ciIcon(item.ciStatus)"
                :name="ciIcon(item.ciStatus)!.name"
                class="size-3.5"
                :class="ciIcon(item.ciStatus)!.class"
              />
            </div>

            <div class="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
              <span class="inline-flex items-center gap-1">
                <NuxtImg
                  :src="item.author.avatarUrl"
                  :alt="item.author.login"
                  class="size-3.5 rounded-full"
                  width="14"
                  height="14"
                />
                {{ item.author.login }}
              </span>
              <span class="text-dimmed">{{ timeAgo(item.updatedAt) }}</span>
              <span class="inline-flex items-center gap-0.5">
                <UIcon
                  name="i-lucide-message-square"
                  class="size-3"
                />
                {{ item.commentCount }}
              </span>
              <div
                v-if="item.labels.length"
                class="flex items-center gap-1"
              >
                <UBadge
                  v-for="label in item.labels.slice(0, 3)"
                  :key="label.name"
                  variant="subtle"
                  size="xs"
                  :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
                >
                  {{ label.name }}
                </UBadge>
              </div>
              <div
                v-if="item.assignees.length"
                class="flex -space-x-1.5"
              >
                <UTooltip
                  v-for="assignee in item.assignees.slice(0, 3)"
                  :key="assignee.login"
                  :text="assignee.login"
                >
                  <NuxtImg
                    :src="assignee.avatarUrl"
                    :alt="assignee.login"
                    class="size-5 rounded-full ring-1 ring-bg"
                    width="20"
                    height="20"
                  />
                </UTooltip>
              </div>
              <span
                v-if="item.linkedPulls.length"
                class="inline-flex items-center gap-0.5 text-blue-500"
              >
                <UIcon
                  name="i-lucide-git-pull-request"
                  class="size-3"
                />
                {{ item.linkedPulls.length }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </template>

      <template v-else>
        <a
          v-for="item in workItems"
          :key="`external-${item.id}`"
          :href="item.htmlUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-primary hover:pl-2.5 transition-all border-b border-default last:border-b-0"
        >
          <UIcon
            :name="item.type === 'issue' ? 'i-lucide-circle-dot' : (item.isDraft ? 'i-lucide-git-pull-request-draft' : 'i-lucide-git-pull-request')"
            class="size-4 shrink-0 mt-0.5"
            :class="item.type === 'issue' ? 'text-rose-500' : 'text-blue-500'"
          />

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm text-highlighted truncate">
                {{ item.title }}
              </span>
              <span class="text-xs text-dimmed shrink-0 font-mono">
                #{{ item.number }}
              </span>
              <UBadge
                size="xs"
                variant="subtle"
                :color="stateBadgeColor(item.state) as any"
              >
                {{ stateBadgeLabel(item) }}
              </UBadge>
              <UBadge
                v-if="prStatusLabel(item)"
                size="xs"
                color="primary"
                variant="subtle"
              >
                {{ prStatusLabel(item) }}
              </UBadge>
              <UIcon
                v-if="ciIcon(item.ciStatus)"
                :name="ciIcon(item.ciStatus)!.name"
                class="size-3.5"
                :class="ciIcon(item.ciStatus)!.class"
              />
            </div>

            <div class="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
              <span class="inline-flex items-center gap-1">
                <NuxtImg
                  :src="item.author.avatarUrl"
                  :alt="item.author.login"
                  class="size-3.5 rounded-full"
                  width="14"
                  height="14"
                />
                {{ item.author.login }}
              </span>
              <span class="text-dimmed">{{ timeAgo(item.updatedAt) }}</span>
              <span class="inline-flex items-center gap-0.5">
                <UIcon
                  name="i-lucide-message-square"
                  class="size-3"
                />
                {{ item.commentCount }}
              </span>
              <div
                v-if="item.labels.length"
                class="flex items-center gap-1"
              >
                <UBadge
                  v-for="label in item.labels.slice(0, 3)"
                  :key="label.name"
                  variant="subtle"
                  size="xs"
                  :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
                >
                  {{ label.name }}
                </UBadge>
              </div>
              <div
                v-if="item.assignees.length"
                class="flex -space-x-1.5"
              >
                <UTooltip
                  v-for="assignee in item.assignees.slice(0, 3)"
                  :key="assignee.login"
                  :text="assignee.login"
                >
                  <NuxtImg
                    :src="assignee.avatarUrl"
                    :alt="assignee.login"
                    class="size-5 rounded-full ring-1 ring-bg"
                    width="20"
                    height="20"
                  />
                </UTooltip>
              </div>
              <span
                v-if="item.linkedPulls.length"
                class="inline-flex items-center gap-0.5 text-blue-500"
              >
                <UIcon
                  name="i-lucide-git-pull-request"
                  class="size-3"
                />
                {{ item.linkedPulls.length }}
              </span>
            </div>
          </div>
        </a>
      </template>
    </template>

    <div
      v-else
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.noResults') }}
    </div>
  </div>
</template>
