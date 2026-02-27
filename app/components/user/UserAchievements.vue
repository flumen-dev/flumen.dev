<script setup lang="ts">
import type { Achievement } from '~~/shared/types/profile'

const props = defineProps<{
  login: string
  compact?: boolean
}>()

const { t } = useI18n()

const { data: achievements } = useFetch<Achievement[]>('/api/user/achievements', {
  params: computed(() => ({ login: props.login })),
  lazy: true,
  default: () => [],
})

const tierColors: Record<number, string> = {
  1: 'bg-muted text-toned',
  2: 'bg-amber-900/30 text-amber-400',
  3: 'bg-gray-400/20 text-gray-300',
  4: 'bg-yellow-500/20 text-yellow-400',
}

function tierClass(tier: number): string {
  return tierColors[tier] ?? tierColors[1]!
}

function achievementUrl(slug: string): string {
  return `https://github.com/${props.login}?tab=achievements&achievement=${slug}`
}
</script>

<template>
  <div
    v-if="achievements.length"
    :class="compact ? '' : 'space-y-2'"
  >
    <h3
      v-if="!compact"
      class="text-xs font-semibold text-muted uppercase tracking-wide"
    >
      {{ t('user.profile.achievements') }}
    </h3>
    <div
      class="flex flex-wrap"
      :class="compact ? 'gap-1.5' : 'gap-2'"
    >
      <a
        v-for="badge in achievements"
        :key="badge.slug"
        :href="achievementUrl(badge.slug)"
        target="_blank"
        rel="noopener noreferrer"
        class="relative group"
        :title="badge.tier > 1 ? `${badge.name} x${badge.tier}` : badge.name"
      >
        <img
          :src="badge.imageUrl"
          :alt="badge.name"
          :class="compact ? 'size-8' : 'size-12'"
          class="rounded-full transition-transform group-hover:scale-110"
        >
        <span
          v-if="badge.tier > 1"
          class="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold rounded-full px-1 leading-tight"
          :class="tierClass(badge.tier)"
        >
          x{{ badge.tier }}
        </span>
      </a>
    </div>
  </div>
</template>
