<script lang="ts" setup>
import type { TimelineItem } from '~~/shared/types/issue-detail'

type NonCommentEvent = Exclude<TimelineItem, { type: 'IssueComment' }>

const props = defineProps<{
  events: NonCommentEvent[]
}>()

const { t } = useI18n()

// Group consecutive events by actor
const actorGroups = computed(() => {
  const groups: Array<{ actor: string, events: NonCommentEvent[], time: string }> = []
  let current: (typeof groups)[number] | null = null

  for (const event of props.events) {
    if (!current || current.actor !== event.actor) {
      current = { actor: event.actor, events: [event], time: event.createdAt }
      groups.push(current)
    }
    else {
      current.events.push(event)
      current.time = event.createdAt
    }
  }

  return groups
})

function groupTimeAgo(time: string) {
  return useTimeAgo(time).value
}
</script>

<template>
  <div class="space-y-0.5">
    <div
      v-for="(group, gi) in actorGroups"
      :key="`${group.actor}-${gi}`"
      class="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 sm:px-4 py-1.5"
    >
      <!-- Actor -->
      <span class="text-xs font-medium text-highlighted">{{ group.actor }}</span>

      <!-- Event chips -->
      <template
        v-for="(event, ei) in group.events"
        :key="ei"
      >
        <!-- Label added -->
        <span
          v-if="event.type === 'LabeledEvent'"
          class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs"
          :style="{ backgroundColor: `#${event.label.color}18`, color: `#${event.label.color}` }"
        >
          <span class="opacity-50">+</span>{{ event.label.name }}
        </span>

        <!-- Label removed -->
        <span
          v-else-if="event.type === 'UnlabeledEvent'"
          class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs line-through opacity-60"
          :style="{ backgroundColor: `#${event.label.color}10`, color: `#${event.label.color}` }"
        >
          {{ event.label.name }}
        </span>

        <!-- Assigned -->
        <span
          v-else-if="event.type === 'AssignedEvent'"
          class="inline-flex items-center gap-0.5 text-xs text-muted"
        >
          <template v-if="event.assignee === event.actor">
            {{ t('issues.event.assignedSelf') }}
          </template>
          <template v-else>
            <span class="opacity-50">&rarr;</span>
            <span class="font-medium text-highlighted">{{ event.assignee }}</span>
          </template>
        </span>

        <!-- Unassigned -->
        <span
          v-else-if="event.type === 'UnassignedEvent'"
          class="inline-flex items-center gap-0.5 text-xs text-muted"
        >
          <span class="opacity-50">&times;</span>
          <span class="line-through">{{ event.assignee }}</span>
        </span>

        <!-- Closed -->
        <span
          v-else-if="event.type === 'ClosedEvent'"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
          :class="event.stateReason === 'NOT_PLANNED'
            ? 'bg-neutral-500/10 text-neutral-400'
            : 'bg-violet-500/10 text-violet-500'"
        >
          <UIcon
            :name="event.stateReason === 'NOT_PLANNED' ? 'i-lucide-circle-slash' : 'i-lucide-check-circle'"
            class="size-3"
          />
          {{ event.stateReason === 'NOT_PLANNED' ? t('issues.closedAsNotPlanned') : t('issues.closedAs') }}
        </span>

        <!-- Reopened -->
        <span
          v-else-if="event.type === 'ReopenedEvent'"
          class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-xs"
        >
          <UIcon
            name="i-lucide-circle-dot"
            class="size-3"
          />
          {{ t('issues.event.reopened') }}
        </span>

        <!-- Cross-referenced -->
        <a
          v-else-if="event.type === 'CrossReferencedEvent'"
          :href="event.source.url"
          target="_blank"
          class="inline-flex items-center gap-1 rounded-full border border-default bg-elevated/50 px-2 py-0.5 text-xs hover:border-primary/50 transition-colors"
        >
          <UIcon
            :name="event.source.type === 'PullRequest' ? 'i-lucide-git-pull-request' : 'i-lucide-link'"
            class="size-3 text-blue-500"
          />
          <span class="text-muted">#{{ event.source.number }}</span>
          <span class="text-muted/60 truncate max-w-32 sm:max-w-48">{{ event.source.title }}</span>
        </a>

        <!-- Milestoned -->
        <span
          v-else-if="event.type === 'MilestonedEvent'"
          class="inline-flex items-center gap-1 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-milestone"
            class="size-3"
          />
          {{ event.milestoneTitle }}
        </span>

        <!-- Renamed -->
        <UTooltip
          v-else-if="event.type === 'RenamedTitleEvent'"
          :text="`${event.previousTitle} → ${event.currentTitle}`"
        >
          <span class="inline-flex items-center gap-1 text-xs text-muted">
            <UIcon
              name="i-lucide-pencil"
              class="size-3"
            />
            {{ t('issues.event.renamed') }}
          </span>
        </UTooltip>

        <!-- Referenced commit -->
        <span
          v-else-if="event.type === 'ReferencedEvent'"
          class="inline-flex items-center gap-1 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-git-commit"
            class="size-3"
          />
          <span class="font-mono">{{ event.commitId.slice(0, 7) }}</span>
        </span>
      </template>

      <!-- Timestamp -->
      <span class="text-xs text-muted/50">&middot;</span>
      <span class="text-xs text-muted/50">{{ groupTimeAgo(group.time) }}</span>
    </div>
  </div>
</template>
