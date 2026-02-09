<script setup lang="ts">
const props = defineProps<{
  owner: string
  repo: string
}>()

const { data: pulls, status } = useLazyFetch<RepoPullRequest[]>(
  `/api/repository/${props.owner}/${props.repo}/pulls`,
)
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <!-- Section header -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border-b border-default text-xs font-medium text-blue-500">
      <UIcon
        name="i-lucide-git-pull-request"
        class="size-3.5"
      />
      {{ $t('nav.pullRequests') }}
    </div>

    <!-- Loading -->
    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <!-- PR rows -->
    <template v-else-if="pulls?.length">
      <a
        v-for="pr in pulls"
        :key="pr.id"
        :href="pr.htmlUrl"
        target="_blank"
        class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-blue-500 hover:pl-2.5 transition-all border-b border-default last:border-b-0"
      >
        <!-- PR icon -->
        <UIcon
          :name="pr.draft ? 'i-lucide-git-pull-request-draft' : 'i-lucide-git-pull-request'"
          :class="pr.draft ? 'text-neutral-400' : 'text-blue-500'"
          class="size-4 shrink-0 mt-0.5"
        />

        <!-- Main content -->
        <div class="min-w-0 flex-1">
          <!-- Row 1: Title + number -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-highlighted truncate">
              {{ pr.title }}
            </span>
            <span class="text-xs text-dimmed shrink-0 font-mono">
              #{{ pr.number }}
            </span>
          </div>

          <!-- Row 2: Meta -->
          <div class="flex items-center gap-2 mt-1 text-xs text-muted">
            <!-- Author -->
            <span class="flex items-center gap-1">
              <NuxtImg
                :src="pr.user.avatarUrl"
                :alt="pr.user.login"
                class="size-3.5 rounded-full"
                width="14"
                height="14"
              />
              {{ pr.user.login }}
            </span>

            <!-- Branch -->
            <span class="font-mono text-dimmed truncate max-w-32">
              {{ pr.headRef }}
            </span>

            <!-- Updated time -->
            <span class="text-dimmed">
              {{ timeAgo(pr.updatedAt) }}
            </span>

            <!-- Comments -->
            <span
              v-if="pr.comments"
              class="flex items-center gap-0.5"
            >
              <UIcon
                name="i-lucide-message-square"
                class="size-3"
              />
              {{ pr.comments }}
            </span>

            <!-- Draft badge -->
            <UBadge
              v-if="pr.draft"
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ $t('repos.badge.draft') }}
            </UBadge>

            <!-- Milestone -->
            <span
              v-if="pr.milestone"
              class="flex items-center gap-0.5 text-dimmed"
            >
              <UIcon
                name="i-lucide-milestone"
                class="size-3"
              />
              {{ pr.milestone }}
            </span>
          </div>
        </div>

        <!-- Right side: Labels + Reviewers + Assignees -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Labels -->
          <div
            v-if="pr.labels.length"
            class="flex items-center gap-1"
          >
            <UBadge
              v-for="label in pr.labels.slice(0, 2)"
              :key="label.name"
              variant="subtle"
              size="xs"
              :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
            >
              {{ label.name }}
            </UBadge>
          </div>

          <!-- Requested Reviewers -->
          <div
            v-if="pr.requestedReviewers.length"
            class="flex -space-x-1.5"
          >
            <UTooltip
              v-for="reviewer in pr.requestedReviewers.slice(0, 3)"
              :key="reviewer.login"
              :text="reviewer.login"
            >
              <NuxtImg
                :src="reviewer.avatarUrl"
                :alt="reviewer.login"
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
