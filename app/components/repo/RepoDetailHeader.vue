<script setup lang="ts">
import type { RepoDetail, RepoHealthStats } from '~~/shared/types/repository'
import { LANGUAGE_COLORS } from '~~/shared/utils/language-colors'
import { computeHealthScore } from '~~/shared/utils/health-score'

const props = defineProps<{
  repo: RepoDetail
  stats: RepoHealthStats | null
}>()

const { isPinned, toggle: togglePin } = usePinnedRepos()
const starStore = useStarStore()

starStore.request(props.repo.fullName)
watch(() => props.repo.fullName, r => starStore.request(r))

const starred = computed(() => starStore.isStarred(props.repo.fullName))
const starCount = computed(() => starStore.starCount(props.repo.fullName))
const starLoaded = computed(() => starStore.isLoaded(props.repo.fullName))
const starPending = computed(() => starStore.isPending(props.repo.fullName))

const isToggling = ref(false)
async function toggleStar() {
  if (isToggling.value) return
  isToggling.value = true
  try {
    await starStore.toggleStar(props.repo.fullName)
  }
  finally {
    isToggling.value = false
  }
}

const primaryLanguage = computed(() => {
  if (!props.stats?.languages) return null
  const entries = Object.entries(props.stats.languages).sort(([, a], [, b]) => b - a)
  if (!entries.length) return null
  const [lang] = entries[0]!
  return { name: lang, color: LANGUAGE_COLORS[lang] ?? '#8b8b8b' }
})

const gradientStyle = computed(() => {
  if (!primaryLanguage.value) return {}
  const color = primaryLanguage.value.color
  return {
    background: `linear-gradient(135deg, ${color}08 0%, ${color}15 50%, transparent 100%)`,
  }
})

const healthScore = computed(() => props.stats ? computeHealthScore(props.stats) : null)

const isOwnRepo = computed(() => props.repo.fullName.toLowerCase() === 'flumen-dev/flumen.dev')
</script>

<template>
  <div
    class="space-y-4 relative"
    :style="gradientStyle"
  >
    <!-- Top row: Avatar + Name + Badges + Health Score -->
    <div class="flex items-start gap-3">
      <UAvatar
        :src="repo.owner.avatarUrl"
        :alt="repo.owner.login"
        size="lg"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-bold text-highlighted leading-tight">
          <span class="text-muted font-normal">{{ repo.owner.login }}</span>
          <span class="text-muted font-normal mx-0.5">/</span>
          {{ repo.name }}
        </h1>

        <!-- Badges -->
        <div class="flex items-center gap-1.5 mt-1">
          <UBadge
            v-if="repo.archived"
            color="warning"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.archived') }}
          </UBadge>
          <UBadge
            v-if="repo.fork"
            color="info"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.fork') }}
          </UBadge>
          <UBadge
            v-if="repo.visibility === 'private'"
            color="neutral"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.private') }}
          </UBadge>
          <UBadge
            v-if="repo.isTemplate"
            color="primary"
            variant="subtle"
            size="xs"
          >
            {{ $t('repos.badge.template') }}
          </UBadge>
        </div>
      </div>

      <!-- Health Score Badge -->
      <UPopover
        v-if="healthScore"
        :popper="{ placement: 'bottom-end' }"
      >
        <div class="flex flex-col items-center px-3 py-1 rounded-xl bg-elevated/50 border border-default cursor-pointer hover:bg-elevated transition-colors">
          <span
            class="text-2xl font-black leading-none"
            :class="healthScore.gradeColor"
          >
            {{ healthScore.grade }}
          </span>
          <span class="text-[10px] text-dimmed uppercase tracking-widest mt-0.5">{{ $t('repos.detail.stats.health') }}</span>
        </div>

        <template #content>
          <div class="p-3 space-y-2.5 w-56">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-highlighted">{{ $t('repos.detail.stats.health') }}</span>
              <span
                class="text-sm font-bold"
                :class="healthScore.gradeColor"
              >{{ healthScore.score }}/100</span>
            </div>
            <div
              v-for="cat in healthScore.categories"
              :key="cat.key"
              class="space-y-1"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted">{{ $t(`repos.detail.stats.healthCategory.${cat.key}`) }}</span>
                <span
                  class="tabular-nums"
                  :class="cat.score === cat.max ? 'text-emerald-400' : cat.score === 0 ? 'text-rose-400' : 'text-amber-400'"
                >{{ cat.score }}/{{ cat.max }}</span>
              </div>
              <div class="h-1 rounded-full bg-elevated overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="cat.score === cat.max ? 'bg-emerald-400' : cat.score === 0 ? 'bg-rose-400' : 'bg-amber-400'"
                  :style="{ width: `${(cat.score / cat.max) * 100}%` }"
                />
              </div>
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <!-- Description -->
    <p
      v-if="repo.description"
      class="text-sm text-muted"
    >
      {{ repo.description }}
    </p>

    <!-- Fork parent -->
    <p
      v-if="repo.parent"
      class="text-xs text-dimmed"
    >
      {{ $t('repos.detail.forkedFrom') }}
      <a
        :href="repo.parent.htmlUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary hover:underline"
      >
        {{ repo.parent.fullName }}
      </a>
    </p>

    <!-- Action bar: Stars, Forks, Watchers, Pin, GitHub -->
    <div class="flex items-center gap-3 flex-wrap">
      <!-- Stars — prominent, interactive -->
      <button
        v-if="stats"
        type="button"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        :class="[
          starred
            ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
            : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
          starPending || isToggling ? 'opacity-60 pointer-events-none' : '',
        ]"
        :disabled="!starLoaded || isToggling"
        @click="toggleStar"
      >
        <UIcon
          name="i-lucide-star"
          class="size-5"
          :class="starred ? 'fill-amber-400' : ''"
        />
        <span class="text-lg font-bold">{{ starLoaded ? starCount.toLocaleString() : stats.stars.toLocaleString() }}</span>
        <span class="text-sm">{{ starred ? $t('repos.unstar') : $t('repos.star') }}</span>
      </button>

      <!-- Forks -->
      <div
        v-if="stats"
        class="flex items-center gap-1.5 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-git-fork"
          class="size-4"
        />
        <span class="font-semibold text-highlighted">{{ stats.forks.toLocaleString() }}</span>
        {{ $t('repos.detail.stats.forks') }}
      </div>

      <!-- Watchers -->
      <div
        v-if="stats"
        class="flex items-center gap-1.5 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-eye"
          class="size-4"
        />
        <span class="font-semibold text-highlighted">{{ stats.watchers.toLocaleString() }}</span>
        {{ $t('repos.detail.stats.watchers') }}
      </div>

      <div class="flex-1" />

      <!-- Pin -->
      <UButton
        :icon="isPinned(repo.fullName) ? 'i-lucide-pin-off' : 'i-lucide-pin'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="togglePin(repo.fullName, repo.fork ? 'fork' : 'repo')"
      >
        {{ isPinned(repo.fullName) ? $t('pinnedRepos.unpin') : $t('pinnedRepos.pin') }}
      </UButton>

      <!-- GitHub link -->
      <UButton
        :to="repo.htmlUrl"
        target="_blank"
        icon="i-lucide-external-link"
        size="xs"
        color="neutral"
        variant="outline"
      >
        {{ $t('repos.detail.viewOnGithub') }}
      </UButton>
    </div>

    <!-- Topics -->
    <div
      v-if="repo.topics.length"
      class="flex flex-wrap gap-1.5"
    >
      <UBadge
        v-for="topic in repo.topics"
        :key="topic"
        color="primary"
        variant="subtle"
        size="xs"
      >
        {{ topic }}
      </UBadge>
    </div>

    <!-- Language breakdown bar -->
    <RepoLanguageBar
      v-if="stats?.languages"
      :languages="stats.languages"
    />

    <!-- Flumen own repo banner -->
    <div
      v-if="isOwnRepo"
      class="own-banner relative rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 overflow-hidden"
    >
      <!-- Floating sparkles -->
      <span
        v-for="i in 6"
        :key="i"
        class="sparkle absolute pointer-events-none select-none text-primary/30"
        :style="{
          left: `${10 + (i * 15) % 80}%`,
          animationDelay: `${i * 0.7}s`,
          fontSize: `${10 + (i % 3) * 4}px`,
        }"
      >&#10022;</span>

      <div class="relative flex items-center gap-2">
        <span class="text-lg animate-pulse">&#128420;</span>
        <span class="text-sm font-semibold text-highlighted">{{ $t('repos.detail.ownBanner.title') }}</span>
      </div>
      <p class="relative text-sm text-muted leading-relaxed">
        {{ $t('repos.detail.ownBanner.description') }}
      </p>
      <div class="relative flex flex-wrap gap-2">
        <div
          v-for="goal in ['openSource', 'noTracking', 'communityDriven', 'betterThanGithub']"
          :key="goal"
          class="flex items-center gap-1.5 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-check-circle"
            class="size-3.5 text-primary"
          />
          {{ $t(`repos.detail.ownBanner.goals.${goal}`) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sparkle {
  bottom: 0;
  animation: float-up 4s ease-in-out infinite;
  opacity: 0;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scale(0.5) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-60px) scale(1.2) rotate(180deg);
    opacity: 0;
  }
}
</style>
