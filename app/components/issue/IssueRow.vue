<script setup lang="ts">
import type { Issue } from '~~/shared/types/issue'

const props = defineProps<{
  issue: Issue
}>()

const { t } = useI18n()
const updatedAgo = useTimeAgo(computed(() => props.issue.updatedAt))

const stateIcon = computed(() => {
  if (props.issue.state === 'OPEN') return 'i-lucide-circle-dot'
  if (props.issue.stateReason === 'NOT_PLANNED') return 'i-lucide-circle-slash'
  return 'i-lucide-check-circle'
})

const stateColor = computed(() => {
  if (props.issue.state === 'OPEN') return 'text-emerald-500'
  if (props.issue.stateReason === 'NOT_PLANNED') return 'text-neutral-400'
  return 'text-violet-500'
})
</script>

<template>
  <a
    :href="issue.url"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors"
  >
    <!-- State icon -->
    <UIcon
      :name="stateIcon"
      class="size-5 mt-0.5 shrink-0"
      :class="stateColor"
    />

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Row 1: Title + labels -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-medium text-highlighted hover:underline">
          {{ issue.title }}
        </span>
        <UBadge
          v-for="label in issue.labels"
          :key="label.name"
          variant="subtle"
          size="xs"
          :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
        >
          {{ label.name }}
        </UBadge>
      </div>

      <!-- Row 2: Meta -->
      <div class="flex items-center gap-3 mt-1 text-xs text-muted">
        <UTooltip
          v-if="!issue.maintainerCommented && issue.commentCount > 0"
          :text="t('issues.needsResponse')"
        >
          <span class="inline-flex items-center gap-0.5 text-amber-500">
            <UIcon
              name="i-lucide-message-circle-warning"
              class="size-3.5"
            />
          </span>
        </UTooltip>
        <span>#{{ issue.number }}</span>
        <span>{{ updatedAgo }}</span>

        <span
          v-if="issue.commentCount"
          class="inline-flex items-center gap-0.5"
        >
          <UIcon
            name="i-lucide-message-square"
            class="size-3.5"
          />
          {{ issue.commentCount }}
        </span>

        <span
          v-if="issue.linkedPrCount"
          class="inline-flex items-center gap-0.5 text-blue-500"
        >
          <UIcon
            name="i-lucide-git-pull-request"
            class="size-3.5"
          />
          {{ issue.linkedPrCount }}
        </span>

        <span
          v-if="issue.state === 'CLOSED'"
          class="inline-flex items-center gap-0.5"
          :class="issue.stateReason === 'NOT_PLANNED' ? 'text-neutral-400' : 'text-violet-500'"
        >
          {{ issue.stateReason === 'NOT_PLANNED' ? t('issues.closedAsNotPlanned') : t('issues.closedAs') }}
        </span>

        <span
          v-if="issue.milestone"
          class="inline-flex items-center gap-0.5"
        >
          <UIcon
            name="i-lucide-milestone"
            class="size-3.5"
          />
          {{ issue.milestone }}
        </span>
      </div>
    </div>

    <!-- Right side: Assignees + author -->
    <div class="flex items-center gap-1 shrink-0">
      <UTooltip
        v-for="assignee in issue.assignees"
        :key="assignee.login"
        :text="assignee.login"
      >
        <UAvatar
          :src="assignee.avatarUrl"
          :alt="assignee.login"
          size="xs"
        />
      </UTooltip>
    </div>
  </a>
</template>
