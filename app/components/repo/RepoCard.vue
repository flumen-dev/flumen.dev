<script setup lang="ts">
import type { Repository } from '~~/shared/types/repository'

const props = defineProps<{
  repo: Repository
  activity?: number[]
  openPrs?: number
  openIssues?: number
  notifications?: number
}>()

const activityColor = computed(() => getActivityColor(props.repo.pushedAt, props.repo.archived))
const timeAgo = useTimeAgo(computed(() => props.repo.pushedAt))
</script>

<template>
  <div class="group flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors">
    <!-- Activity dot -->
    <div class="mt-1.5 shrink-0">
      <span
        class="block size-2.5 rounded-full"
        :class="activityColor"
        style="background-color: currentColor;"
      />
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Row 1: Name + badges + time -->
      <div class="flex items-center gap-2">
        <NuxtLink
          :to="repo.htmlUrl"
          external
          target="_blank"
          class="font-semibold text-highlighted truncate hover:underline"
        >
          {{ repo.name }}
        </NuxtLink>

        <UBadge
          v-if="repo.archived"
          color="warning"
          variant="subtle"
          size="xs"
        >
          archived
        </UBadge>
        <UBadge
          v-if="repo.fork"
          color="info"
          variant="subtle"
          size="xs"
        >
          fork
        </UBadge>
        <UBadge
          v-if="repo.visibility === 'private'"
          color="neutral"
          variant="subtle"
          size="xs"
        >
          private
        </UBadge>

        <!-- Issues / PRs / Notifications — icon + count, no border -->
        <UTooltip
          v-if="openIssues"
          :text="$t('repos.openIssues', { count: openIssues })"
        >
          <span class="inline-flex items-center gap-0.5 text-xs font-medium text-rose-500">
            <UIcon
              name="i-lucide-circle-dot"
              class="size-4"
            />
            {{ openIssues }}
          </span>
        </UTooltip>

        <UTooltip
          v-if="openPrs"
          :text="$t('repos.openPrs', { count: openPrs })"
        >
          <span class="inline-flex items-center gap-0.5 text-xs font-medium text-blue-500">
            <UIcon
              name="i-lucide-git-pull-request"
              class="size-4"
            />
            {{ openPrs }}
          </span>
        </UTooltip>

        <UTooltip
          v-if="notifications"
          :text="$t('repos.unreadNotifications', { count: notifications })"
        >
          <span class="inline-flex items-center gap-0.5 text-sm font-semibold text-amber-400">
            <UIcon
              name="i-lucide-bell"
              class="size-4.5 animate-bell"
            />
            {{ notifications }}
          </span>
        </UTooltip>

        <div class="ml-auto flex items-center gap-2 shrink-0">
          <RepoSparkline
            v-if="activity"
            :weeks="activity"
          />
          <span class="text-xs text-dimmed">
            {{ timeAgo }}
          </span>
        </div>
      </div>

      <!-- Row 2: Description (always rendered for consistent height) -->
      <p class="text-sm text-muted truncate mt-0.5 min-h-5">
        {{ repo.description }}
      </p>

      <!-- Row 3: Stats -->
      <div class="mt-1.5">
        <RepoStats :repo="repo" />
      </div>
    </div>
  </div>
</template>
