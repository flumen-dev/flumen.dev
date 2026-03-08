<script setup lang="ts">
import type { RepoHealthStats } from '~~/shared/types/repository'

const props = defineProps<{
  stats: RepoHealthStats
  defaultBranch?: string
}>()

const { open: openProfile } = useUserProfileDialog()
const lastCommitAgo = useTimeAgo(computed(() => props.stats.lastCommitDate ?? new Date().toISOString()))
const releaseDate = computed(() => props.stats.lastRelease?.publishedAt ?? new Date().toISOString())
const releaseAgo = useTimeAgo(releaseDate)

const RANK_COLORS = ['text-amber-400', 'text-zinc-400', 'text-amber-700'] as const

const topContributors = computed(() => {
  const top = props.stats.topContributors.slice(0, 8)
  if (!top.length) return []
  const maxContrib = Math.max(...top.map(t => t.contributions), 0)
  return top.map((c, i) => ({
    ...c,
    rank: i + 1,
    pct: maxContrib > 0 ? Math.min(100, (c.contributions / maxContrib) * 100) : 0,
    rankColor: RANK_COLORS[i] ?? 'text-dimmed',
    isPodium: i < 3,
  }))
})
</script>

<template>
  <UCard>
    <div class="space-y-4 p-1">
      <!-- About section -->
      <div class="space-y-3">
        <p class="text-xs font-medium text-dimmed uppercase tracking-wide">
          {{ $t('repos.detail.stats.about') }}
        </p>

        <!-- License -->
        <div class="flex items-center gap-2 text-sm">
          <UIcon
            name="i-lucide-scale"
            class="size-4 text-muted"
          />
          <span class="text-dimmed">{{ $t('repos.detail.stats.license') }}</span>
          <span class="text-highlighted ml-auto">{{ stats.license ?? '—' }}</span>
        </div>

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

        <!-- Default branch -->
        <div
          v-if="defaultBranch"
          class="flex items-center gap-2 text-sm"
        >
          <UIcon
            name="i-lucide-git-branch"
            class="size-4 text-muted"
          />
          <span class="text-dimmed">{{ $t('repos.detail.stats.defaultBranch') }}</span>
          <UBadge
            color="neutral"
            variant="subtle"
            size="xs"
            class="ml-auto"
          >
            {{ defaultBranch }}
          </UBadge>
        </div>

        <!-- Open Issues -->
        <div class="flex items-center gap-2 text-sm">
          <UIcon
            name="i-lucide-circle-dot"
            class="size-4 text-rose-400"
          />
          <span class="text-dimmed">{{ $t('repos.detail.stats.openIssues') }}</span>
          <span class="text-highlighted ml-auto">{{ stats.openIssues.toLocaleString() }}</span>
        </div>

        <!-- Open PRs -->
        <div class="flex items-center gap-2 text-sm">
          <UIcon
            name="i-lucide-git-pull-request"
            class="size-4 text-blue-400"
          />
          <span class="text-dimmed">{{ $t('repos.detail.stats.openPrs') }}</span>
          <span class="text-highlighted ml-auto">{{ stats.openPrs.toLocaleString() }}</span>
        </div>
      </div>

      <USeparator />

      <!-- Contributors leaderboard -->
      <div
        v-if="topContributors.length"
        class="space-y-3"
      >
        <p class="text-xs font-medium text-dimmed uppercase tracking-wide">
          {{ $t('repos.detail.stats.topContributors') }}
        </p>
        <div class="space-y-1.5">
          <button
            v-for="c in topContributors"
            :key="c.login"
            type="button"
            class="flex items-center gap-2 w-full text-left hover:bg-elevated rounded-md px-1.5 py-1.5 -mx-1.5 cursor-pointer transition-colors group"
            @click="openProfile(c.login)"
          >
            <!-- Rank -->
            <span
              class="text-xs font-bold w-4 text-center shrink-0"
              :class="c.rankColor"
            >
              {{ c.rank }}
            </span>
            <UAvatar
              :src="c.avatarUrl"
              :alt="c.login"
              size="2xs"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-highlighted truncate group-hover:text-primary transition-colors">{{ c.login }}</span>
                <span class="text-xs text-dimmed tabular-nums shrink-0">{{ c.contributions.toLocaleString() }}</span>
              </div>
              <!-- Progress bar -->
              <div class="h-1 mt-1 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="c.isPodium ? 'bg-primary' : 'bg-muted'"
                  :style="{ width: `${c.pct}%` }"
                />
              </div>
            </div>
          </button>
        </div>
        <p
          v-if="stats.contributorsCount > 8"
          class="text-xs text-dimmed"
        >
          {{ $t('repos.detail.stats.andMore', { count: stats.contributorsCount - 8 }) }}
        </p>
      </div>

      <USeparator v-if="stats.topContributors.length && stats.weeklyCommitActivity.length" />

      <!-- Activity section -->
      <div v-if="stats.weeklyCommitActivity.length">
        <p class="text-xs font-medium text-dimmed uppercase tracking-wide mb-2">
          {{ $t('repos.detail.stats.commitActivity') }}
        </p>
        <RepoSparkline
          :weeks="stats.weeklyCommitActivity"
          :compact="false"
          :height="48"
        />
      </div>
    </div>
  </UCard>
</template>
