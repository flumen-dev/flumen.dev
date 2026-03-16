<script setup lang="ts">
import type { WorkItem } from '~~/shared/types/work-item'

const props = defineProps<{
  item: WorkItem
  repo: string
  stateBadgeColor: string
  stateBadgeLabel: string
  prStatusLabel: string | null
  ciIcon: { name: string, color: string, spin?: boolean } | null
}>()

const { t } = useI18n()
const { localLabels, onLabelAdded, onLabelRemoved } = useLocalLabels(() => props.item.labels)

const hasLinkedPr = computed(() => props.item.linkedPulls.some(p => !p.state || p.state === 'OPEN'))
const hasLinkedIssue = computed(() => props.item.linkedIssues.some(i => !i.state || i.state === 'OPEN'))

const itemTypeTooltip = computed(() => {
  if (props.item.type === 'issue' && hasLinkedPr.value) return t('workItems.type.issueWithPr')
  if (props.item.type === 'pull' && hasLinkedIssue.value) return t('workItems.type.prWithIssue')
  if (props.item.type === 'issue') return t('workItems.type.issue')
  return t('workItems.type.pr')
})
</script>

<template>
  <UTooltip :text="itemTypeTooltip">
    <div class="relative shrink-0 mt-0.5">
      <UIcon
        :name="item.type === 'issue' ? getIssueStateIcon(item.state) : getPRStateIcon(item.state, item.isDraft)"
        class="size-4"
        :class="item.type === 'issue' ? getIssueStateColor(item.state) : getPRStateColor(item.state, item.isDraft)"
      />
      <UIcon
        v-if="item.type === 'issue' && hasLinkedPr"
        name="i-lucide-git-pull-request"
        class="size-2.5 absolute -bottom-1 -right-1 text-blue-500"
      />
      <UIcon
        v-else-if="item.type === 'pull' && hasLinkedIssue"
        name="i-lucide-circle-dot"
        class="size-2.5 absolute -bottom-1 -right-1 text-emerald-500"
      />
    </div>
  </UTooltip>

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
        :color="stateBadgeColor as any"
      >
        {{ stateBadgeLabel }}
      </UBadge>
      <UBadge
        v-if="prStatusLabel"
        size="xs"
        color="primary"
        variant="subtle"
      >
        {{ prStatusLabel }}
      </UBadge>
      <UIcon
        v-if="ciIcon"
        :name="ciIcon.name"
        class="size-3.5"
        :class="[ciIcon.color, ciIcon.spin ? 'animate-spin' : '']"
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
      <UiLabelManager
        :repo="repo"
        :number="item.number"
        :labels="localLabels"
        @added="onLabelAdded"
        @removed="onLabelRemoved"
      />
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
</template>
