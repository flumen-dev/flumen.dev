<script setup lang="ts">
import type { RepoHealthStats } from '~~/shared/types/repository'

const props = defineProps<{
  stats: RepoHealthStats
}>()

const lastCommitAgo = useTimeAgo(computed(() => props.stats.lastCommitDate ?? new Date().toISOString()))
const releaseDate = computed(() => props.stats.lastRelease?.publishedAt ?? new Date().toISOString())
const releaseAgo = useTimeAgo(releaseDate)
</script>

<template>
  <UCard>
    <div class="space-y-4 p-1">
      <!-- Key metrics grid -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Stars -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-star"
            class="size-4 text-amber-400"
          />
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ stats.stars.toLocaleString() }}
            </p>
            <p class="text-xs text-dimmed">
              {{ $t('repos.detail.stats.stars') }}
            </p>
          </div>
        </div>

        <!-- Forks -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-git-fork"
            class="size-4 text-blue-400"
          />
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ stats.forks.toLocaleString() }}
            </p>
            <p class="text-xs text-dimmed">
              {{ $t('repos.detail.stats.forks') }}
            </p>
          </div>
        </div>

        <!-- Watchers -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-eye"
            class="size-4 text-muted"
          />
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ stats.watchers.toLocaleString() }}
            </p>
            <p class="text-xs text-dimmed">
              {{ $t('repos.detail.stats.watchers') }}
            </p>
          </div>
        </div>

        <!-- Open Issues -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-circle-dot"
            class="size-4 text-rose-400"
          />
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ stats.openIssues.toLocaleString() }}
            </p>
            <p class="text-xs text-dimmed">
              {{ $t('repos.detail.stats.openIssues') }}
            </p>
          </div>
        </div>

        <!-- Open PRs -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-git-pull-request"
            class="size-4 text-blue-400"
          />
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ stats.openPrs.toLocaleString() }}
            </p>
            <p class="text-xs text-dimmed">
              {{ $t('repos.detail.stats.openPrs') }}
            </p>
          </div>
        </div>

        <!-- Contributors -->
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-users"
            class="size-4 text-muted"
          />
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ stats.contributorsCount.toLocaleString() }}
            </p>
            <p class="text-xs text-dimmed">
              {{ $t('repos.detail.stats.contributors') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <USeparator />

      <!-- Last commit -->
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          name="i-lucide-git-commit-horizontal"
          class="size-4 text-muted"
        />
        <span class="text-dimmed">{{ $t('repos.detail.stats.lastCommit') }}</span>
        <span class="text-highlighted ml-auto">{{ stats.lastCommitDate ? lastCommitAgo : '—' }}</span>
      </div>

      <!-- Last release -->
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          name="i-lucide-tag"
          class="size-4 text-muted"
        />
        <span class="text-dimmed">{{ $t('repos.detail.stats.lastRelease') }}</span>
        <span
          v-if="stats.lastRelease"
          class="ml-auto text-right"
        >
          <a
            :href="stats.lastRelease.htmlUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline text-sm"
          >
            {{ stats.lastRelease.tagName }}
          </a>
          <span class="text-xs text-dimmed ml-1">{{ releaseAgo }}</span>
        </span>
        <span
          v-else
          class="text-dimmed ml-auto"
        >{{ $t('repos.detail.stats.noRelease') }}</span>
      </div>

      <!-- License -->
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          name="i-lucide-scale"
          class="size-4 text-muted"
        />
        <span class="text-dimmed">{{ $t('repos.detail.stats.license') }}</span>
        <span class="text-highlighted ml-auto">{{ stats.license ?? '—' }}</span>
      </div>

      <!-- Contributors avatars -->
      <div
        v-if="stats.topContributors.length"
        class="space-y-2"
      >
        <p class="text-xs text-dimmed">
          {{ $t('repos.detail.stats.topContributors') }}
        </p>
        <div class="flex -space-x-1.5">
          <UTooltip
            v-for="contributor in stats.topContributors.slice(0, 8)"
            :key="contributor.login"
            :text="contributor.login"
          >
            <UAvatar
              :src="contributor.avatarUrl"
              :alt="contributor.login"
              size="xs"
              class="ring-2 ring-default"
            />
          </UTooltip>
          <span
            v-if="stats.contributorsCount > 8"
            class="flex items-center justify-center size-6 rounded-full bg-elevated text-xs text-dimmed ring-2 ring-default"
          >
            +{{ stats.contributorsCount - 8 }}
          </span>
        </div>
      </div>

      <!-- Sparkline -->
      <div v-if="stats.weeklyCommitActivity.length">
        <p class="text-xs text-dimmed mb-1">
          {{ $t('repos.detail.stats.commitActivity') }}
        </p>
        <RepoSparkline
          :weeks="stats.weeklyCommitActivity"
          :compact="false"
          :height="36"
        />
      </div>
    </div>
  </UCard>
</template>
