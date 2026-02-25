<script setup lang="ts">
import type { ContributionSkin } from '~~/shared/types/settings'

const props = defineProps<{
  login: string
}>()

const { t, d, locale } = useI18n()
const { settings, update } = useUserSettings()

const skin = computed(() => settings.value.contributionSkin)

const skins: { value: ContributionSkin, icon: string }[] = [
  { value: 'default', icon: 'i-lucide-grid-2x2' },
  { value: 'grass', icon: 'i-lucide-sprout' },
  { value: 'fire', icon: 'i-lucide-flame' },
]

function cycleSkin() {
  const idx = skins.findIndex(s => s.value === skin.value)
  const next = skins[(idx + 1) % skins.length]!
  update({ contributionSkin: next.value })
}

const { data, status } = useFetch('/api/user/contributions', {
  params: { login: props.login },
  lazy: true,
})

const maxCount = computed(() => {
  if (!data.value) return 0
  let max = 0
  for (const week of data.value.weeks) {
    for (const day of week) {
      if (day.count > max) max = day.count
    }
  }
  return max
})

function intensity(count: number): number {
  if (count === 0 || maxCount.value === 0) return 0
  const ratio = count / maxCount.value
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const skinBaseColors: Record<string, string> = {
  default: 'var(--ui-primary)',
  fire: '#ef4444',
}

function heatmapFill(level: number): string {
  if (level === 0) return 'var(--ui-bg-accented)'
  const base = skinBaseColors[skin.value] ?? 'var(--ui-primary)'
  const pct = [0, 25, 50, 75, 100][level]
  return `color-mix(in oklab, ${base} ${pct}%, var(--ui-bg-accented))`
}

function cellBg(count: number): string {
  const level = intensity(count)
  if (skin.value === 'grass') {
    return level > 0 ? '#3b2617' : 'var(--ui-bg-accented)'
  }
  return heatmapFill(level)
}

function tooltipText(day: { date: string, count: number }): string {
  return t('user.profile.contributionDay', {
    count: day.count,
    date: d(Date.parse(day.date), 'long'),
  })
}

const MIN_LABEL_GAP = 4

const monthLabels = computed(() => {
  if (!data.value) return []
  const labels: { text: string, col: number }[] = []
  let lastMonth = -1
  let lastCol = -MIN_LABEL_GAP
  for (let w = 0; w < data.value.weeks.length; w++) {
    const firstDay = data.value.weeks[w]?.[0]
    if (!firstDay) continue
    const date = new Date(firstDay.date)
    const month = date.getMonth()
    if (month !== lastMonth && w - lastCol >= MIN_LABEL_GAP) {
      lastMonth = month
      lastCol = w
      labels.push({
        text: date.toLocaleDateString(locale.value, { month: 'short' }),
        col: w,
      })
    }
  }
  return labels
})
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-muted uppercase tracking-wide">
        {{ t('user.profile.contributions') }}
      </span>
      <div class="flex items-center gap-2">
        <span
          v-if="data"
          class="text-xs text-dimmed"
        >
          {{ t('user.profile.contributionsTotal', { count: data.totalContributions }) }}
        </span>
        <button
          type="button"
          class="p-0.5 rounded text-muted hover:text-highlighted transition-colors cursor-pointer"
          :aria-label="t('settings.appearance.contributionSkin')"
          @click="cycleSkin"
        >
          <UIcon
            :name="skins.find(s => s.value === skin)?.icon ?? 'i-lucide-grid-2x2'"
            class="size-3.5"
          />
        </button>
      </div>
    </div>

    <div
      v-if="status === 'pending'"
      class="h-25 rounded-lg bg-elevated animate-pulse"
    />

    <template v-else-if="data">
      <!-- Month labels -->
      <div
        class="grid gap-0.5"
        :style="{ gridTemplateColumns: `repeat(${data.weeks.length}, 1fr)` }"
      >
        <span
          v-for="label in monthLabels"
          :key="label.col"
          class="text-[10px] text-dimmed"
          :style="{ gridColumn: label.col + 1 }"
        >
          {{ label.text }}
        </span>
      </div>

      <!-- Grid -->
      <div
        class="grid gap-0.5"
        :style="{
          gridTemplateColumns: `repeat(${data.weeks.length}, 1fr)`,
          gridTemplateRows: 'repeat(7, 1fr)',
          gridAutoFlow: 'column',
        }"
      >
        <template
          v-for="(week, wi) in data.weeks"
          :key="wi"
        >
          <UTooltip
            v-for="day in week"
            :key="day.date"
            :text="tooltipText(day)"
          >
            <div
              class="aspect-square w-full rounded-sm relative"
              :class="{ 'overflow-hidden': skin === 'grass' }"
              :style="{ backgroundColor: cellBg(day.count) }"
            >
              <!-- Grass blades -->
              <div
                v-if="skin === 'grass' && intensity(day.count) >= 1"
                class="grass-blades absolute bottom-0 inset-x-0"
                :class="`grass-${intensity(day.count)}`"
              >
                <span class="blade" />
                <span class="blade" />
                <span class="blade" />
                <span class="blade" />
                <span class="blade" />
                <template v-if="intensity(day.count) >= 2">
                  <span class="blade" />
                  <span class="blade" />
                </template>
                <span
                  v-if="intensity(day.count) >= 3"
                  class="blade"
                />
              </div>

              <!-- Fire flames -->
              <template v-if="skin === 'fire' && intensity(day.count) >= 2">
                <div
                  class="fire-core absolute bottom-0 inset-x-0 overflow-visible"
                  :class="`fire-${intensity(day.count)}`"
                >
                  <span class="flame flame-red" />
                  <span class="flame flame-orange" />
                  <span class="flame flame-yellow" />
                  <span
                    v-if="intensity(day.count) >= 3"
                    class="flame flame-red"
                  />
                  <span
                    v-if="intensity(day.count) >= 4"
                    class="flame flame-yellow"
                  />
                </div>
                <span
                  v-if="intensity(day.count) >= 3"
                  class="spark spark-1"
                />
                <span
                  v-if="intensity(day.count) >= 4"
                  class="spark spark-2"
                />
              </template>
            </div>
          </UTooltip>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* === Grass === */
.grass-blades {
  display: flex;
  align-items: flex-end;
  justify-content: space-evenly;
  width: 100%;
  pointer-events: none;
}

.blade {
  display: block;
  width: 2px;
  border-radius: 1px 1px 0 0;
  transform-origin: bottom center;
  background: #22c55e;
}

/* Randomise each blade via nth-child */
.blade:nth-child(odd) { background: #16a34a; }
.blade:nth-child(3n) { background: #15803d; }
.blade:nth-child(4n+1) { background: #4ade80; }

.blade:nth-child(1) { height: 80%; transform: rotate(-12deg); }
.blade:nth-child(2) { height: 60%; transform: rotate(8deg); }
.blade:nth-child(3) { height: 90%; transform: rotate(-3deg); }
.blade:nth-child(4) { height: 55%; transform: rotate(-15deg); }
.blade:nth-child(5) { height: 70%; transform: rotate(11deg); }
.blade:nth-child(6) { height: 85%; transform: rotate(-7deg); }
.blade:nth-child(7) { height: 50%; transform: rotate(14deg); }
.blade:nth-child(8) { height: 95%; transform: rotate(-5deg); }

.grass-1 { height: 35%; }
.grass-2 { height: 55%; }
.grass-3 { height: 75%; }
.grass-4 { height: 95%; }

/* Gentle sway — additive via animation so base rotate is preserved */
.blade { animation: sway 2.5s ease-in-out infinite alternate; }
.blade:nth-child(even) { animation-direction: alternate-reverse; }
.blade:nth-child(3n) { animation-duration: 3s; }

@keyframes sway {
  from { rotate: 0deg; }
  to { rotate: 4deg; }
}

/* === Fire === */
.fire-core {
  display: flex;
  align-items: flex-end;
  justify-content: space-evenly;
  width: 100%;
  pointer-events: none;
}

.flame {
  display: block;
  border-radius: 50% 50% 20% 20%;
  transform-origin: bottom center;
  animation: flicker 0.7s ease-in-out infinite alternate;
}

.flame-red { width: 2.5px; background: #ef4444; }
.flame-orange { width: 3px; background: #f97316; }
.flame-yellow { width: 2px; background: #fbbf24; }

.flame:nth-child(even) { animation-direction: alternate-reverse; }
.flame:nth-child(2) { animation-duration: 0.8s; }
.flame:nth-child(3) { animation-duration: 0.5s; }
.flame:nth-child(4) { animation-duration: 0.65s; }
.flame:nth-child(5) { animation-duration: 0.9s; }

.fire-2 { height: 60%; }
.fire-2 .flame:nth-child(1) { height: 70%; }
.fire-2 .flame:nth-child(2) { height: 90%; }
.fire-2 .flame:nth-child(3) { height: 55%; }

.fire-3 { height: 90%; }
.fire-3 .flame:nth-child(1) { height: 75%; }
.fire-3 .flame:nth-child(2) { height: 100%; }
.fire-3 .flame:nth-child(3) { height: 65%; }
.fire-3 .flame:nth-child(4) { height: 80%; }

.fire-4 { height: 130%; }
.fire-4 .flame:nth-child(1) { height: 70%; }
.fire-4 .flame:nth-child(2) { height: 95%; }
.fire-4 .flame:nth-child(3) { height: 60%; }
.fire-4 .flame:nth-child(4) { height: 80%; }
.fire-4 .flame:nth-child(5) { height: 50%; }

@keyframes flicker {
  from { transform: scaleY(1) scaleX(1) rotate(-2deg); }
  to { transform: scaleY(1.25) scaleX(0.8) rotate(2deg); }
}

/* Sparks */
.spark {
  position: absolute;
  width: 1.5px;
  height: 1.5px;
  background: #fbbf24;
  border-radius: 50%;
  pointer-events: none;
}

.spark-1 {
  bottom: 70%;
  left: 30%;
  animation: spark 1.8s ease-out infinite;
}

.spark-2 {
  bottom: 50%;
  left: 65%;
  animation: spark 2.2s ease-out infinite 0.6s;
}

@keyframes spark {
  0% { transform: translate(0, 0); opacity: 0.9; }
  50% { opacity: 0.5; }
  100% { transform: translate(3px, -8px); opacity: 0; }
}
</style>
