<script setup lang="ts">
const props = defineProps<{
  owner: string
  repo: string
}>()

const { data: issues, status } = useLazyFetch<RepoIssue[]>(
  `/api/repository/${props.owner}/${props.repo}/issues`,
)
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <!-- Section header -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border-b border-default text-xs font-medium text-rose-500">
      <UIcon
        name="i-lucide-circle-dot"
        class="size-3.5"
      />
      {{ $t('nav.issues') }}
    </div>

    <!-- Loading -->
    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <!-- Issue rows -->
    <template v-else-if="issues?.length">
      <a
        v-for="issue in issues"
        :key="issue.id"
        :href="issue.htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-rose-500 hover:pl-2.5 transition-all border-b border-default last:border-b-0"
      >
        <!-- Issue icon -->
        <UIcon
          name="i-lucide-circle-dot"
          class="size-4 text-rose-500 shrink-0 mt-0.5"
        />

        <!-- Main content -->
        <div class="min-w-0 flex-1">
          <!-- Row 1: Title + number -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-highlighted truncate">
              {{ issue.title }}
            </span>
            <span class="text-xs text-dimmed shrink-0 font-mono">
              #{{ issue.number }}
            </span>
          </div>

          <!-- Row 2: Meta -->
          <div class="flex items-center gap-2 mt-1 text-xs text-muted">
            <!-- Author -->
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

            <!-- Updated time -->
            <span class="text-dimmed">
              {{ timeAgo(issue.updatedAt) }}
            </span>

            <!-- Comments -->
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

            <!-- Milestone -->
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

        <!-- Right side: Labels + Assignees -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Labels -->
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

          <!-- Assignees -->
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
      </a>
    </template>

    <!-- Empty -->
    <div
      v-else
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.noResults') }}
    </div>
  </div>
</template>
