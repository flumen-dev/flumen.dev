<script setup lang="ts">
import type { RepoIssue } from '~~/shared/types/repository'

defineProps<{
  issue: RepoIssue
}>()
</script>

<template>
  <UIcon
    name="i-lucide-circle-dot"
    class="size-4 text-rose-500 shrink-0 mt-0.5"
  />

  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      <span class="text-sm text-highlighted truncate">
        {{ issue.title }}
      </span>
      <span class="text-xs text-dimmed shrink-0 font-mono">
        #{{ issue.number }}
      </span>
    </div>

    <div class="flex items-center gap-2 mt-1 text-xs text-muted">
      <span class="flex items-center gap-1">
        <NuxtImg
          :src="issue.user.avatarUrl"
          :alt="issue.user.login"
          class="size-3.5 rounded-full"
          width="14"
          height="14"
        />
        {{ issue.user.login }}
      </span>

      <span class="text-dimmed">
        {{ timeAgo(issue.updatedAt) }}
      </span>

      <span
        v-if="issue.comments"
        class="flex items-center gap-0.5"
      >
        <UIcon
          name="i-lucide-message-square"
          class="size-3"
        />
        {{ issue.comments }}
      </span>

      <span
        v-if="issue.milestone"
        class="flex items-center gap-0.5 text-dimmed"
      >
        <UIcon
          name="i-lucide-milestone"
          class="size-3"
        />
        {{ issue.milestone }}
      </span>
    </div>
  </div>

  <div class="flex items-center gap-2 shrink-0">
    <div
      v-if="issue.labels.length"
      class="flex items-center gap-1"
    >
      <UBadge
        v-for="label in issue.labels.slice(0, 2)"
        :key="label.name"
        variant="subtle"
        size="xs"
        :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
      >
        {{ label.name }}
      </UBadge>
    </div>

    <div
      v-if="issue.assignees.length"
      class="flex -space-x-1.5"
    >
      <UTooltip
        v-for="assignee in issue.assignees.slice(0, 3)"
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
  </div>
</template>
