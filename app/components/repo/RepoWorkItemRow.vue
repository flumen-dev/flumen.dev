<script setup lang="ts">
import type { WorkItem } from '~~/shared/types/work-item'

defineProps<{
  item: WorkItem
  stateBadgeColor: string
  stateBadgeLabel: string
  prStatusLabel: string | null
  ciIcon: { name: string, class: string } | null
}>()
</script>

<template>
  <UIcon
    :name="item.type === 'issue' ? 'i-lucide-circle-dot' : (item.isDraft ? 'i-lucide-git-pull-request-draft' : 'i-lucide-git-pull-request')"
    class="size-4 shrink-0 mt-0.5"
    :class="item.type === 'issue' ? 'text-rose-500' : (item.isDraft ? 'text-neutral-400' : 'text-blue-500')"
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
        :class="ciIcon.class"
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
</template>
