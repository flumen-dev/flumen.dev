<script setup lang="ts">
import type { EChartsInitOpts } from 'echarts'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import type { PulseItem } from '~~/shared/types/pulse'
import { buildWorkItemPath } from '~/utils/workItemPath'

const { t } = useI18n()
const localePath = useLocalePath()
const store = useDashboardStore()
const colorMode = useColorMode()

const pulse = computed(() => store.pulse.data)
const totals = computed(() => pulse.value?.totals)
const days = computed(() => pulse.value?.days ?? [])

const hasActivity = computed(() => {
  const tt = totals.value
  return tt && (tt.incoming > 0 || tt.resolved > 0)
})

const ratioColor = computed(() => {
  const ratio = totals.value?.ratio ?? 0
  if (ratio > 1) return 'success'
  if (ratio === 1) return 'warning'
  return 'error'
})

const ratioLabel = computed(() => {
  const ratio = totals.value?.ratio ?? 0
  if (ratio > 1) return t('dashboard.pulse.clearing')
  if (ratio === 1) return t('dashboard.pulse.keeping')
  return t('dashboard.pulse.falling')
})

const dayLabels = computed(() =>
  days.value.map((d) => {
    const date = new Date(d.date + 'T00:00:00')
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  }),
)

// --- Selected day for detail view ---
const selectedDayIndex = ref<number | null>(null)

const selectedDay = computed<PulseDay | null>(() => {
  if (selectedDayIndex.value === null) return null
  return days.value[selectedDayIndex.value] ?? null
})

const selectedDayLabel = computed(() => {
  if (!selectedDay.value) return ''
  return new Date(selectedDay.value.date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
})

function onChartClick(params: { dataIndex?: number }) {
  if (params.dataIndex === undefined) return
  selectedDayIndex.value = selectedDayIndex.value === params.dataIndex ? null : params.dataIndex
}

// --- Chart ---
const initOptions = computed<EChartsInitOpts>(() => ({
  renderer: 'svg' as const,
  height: 120,
}))

const option = computed<ECBasicOption>(() => {
  const isDark = colorMode.value === 'dark'
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'

  return {
    grid: { top: 8, right: 8, bottom: 24, left: 28 },
    xAxis: {
      type: 'category' as const,
      data: dayLabels.value,
      axisLabel: { fontSize: 10, color: textColor },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
      axisLabel: { fontSize: 10, color: textColor },
    },
    series: [
      {
        name: t('dashboard.pulse.resolved'),
        type: 'bar' as const,
        data: days.value.map(d => d.resolved),
        itemStyle: { color: '#10b981', borderRadius: [2, 2, 0, 0] },
        barGap: '20%',
        cursor: 'pointer',
      },
      {
        name: t('dashboard.pulse.incoming'),
        type: 'bar' as const,
        data: days.value.map(d => d.incoming),
        itemStyle: { color: '#f97316', borderRadius: [2, 2, 0, 0] },
        cursor: 'pointer',
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params: unknown) {
        const series = params as Array<{ seriesName: string, value: number, color: string }>
        if (!series.length) return ''
        return series
          .filter(s => s.value > 0)
          .map(s => `<span style="color:${s.color}">●</span> ${s.value} ${s.seriesName}`)
          .join('<br>')
      },
    },
  }
})

const panelCollapsed = computed(() => store.isCollapsed('pulse'))

const collapsedText = computed(() => {
  const tt = totals.value
  if (!tt) return ''
  return t('dashboard.pulse.collapsed', {
    ratio: tt.ratio,
    resolved: tt.resolved,
    incoming: tt.incoming,
  })
})

const stats = computed(() => [
  { label: t('dashboard.pulse.incoming'), value: totals.value?.incoming ?? 0, icon: 'i-lucide-inbox', color: 'text-orange-500' },
  { label: t('dashboard.pulse.prsMerged'), value: totals.value?.prsMerged ?? 0, icon: 'i-lucide-git-merge', color: 'text-emerald-500' },
  { label: t('dashboard.pulse.issuesClosed'), value: totals.value?.issuesClosed ?? 0, icon: 'i-lucide-circle-check', color: 'text-emerald-500' },
])

function pulseItemLink(item: PulseItem) {
  const path = buildWorkItemPath(item.repo, item.number)
  return path ? localePath(path) : item.url
}

function pulseItemExternal(item: PulseItem) {
  return !buildWorkItemPath(item.repo, item.number)
}
</script>

<template>
  <div class="rounded-lg border border-default overflow-hidden">
    <!-- Header -->
    <button
      class="flex w-full items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-elevated transition-colors"
      @click="store.togglePanel('pulse')"
    >
      <UIcon
        name="i-lucide-activity"
        class="size-5 text-highlighted shrink-0"
      />
      <h2 class="text-sm font-semibold text-highlighted">
        {{ t('dashboard.pulse.title') }}
      </h2>
      <UBadge
        v-if="hasActivity && totals"
        :label="t('dashboard.pulse.ratio', { ratio: totals.ratio })"
        :color="ratioColor"
        variant="subtle"
        size="sm"
      />
      <span
        v-if="panelCollapsed && totals"
        class="text-xs text-muted truncate"
      >
        {{ collapsedText }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <UIcon
          v-if="store.pulse.loading"
          name="i-lucide-loader-2"
          class="size-4 text-dimmed animate-spin"
        />
        <UIcon
          :name="panelCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          class="size-4 text-dimmed"
        />
      </div>
    </button>

    <template v-if="!panelCollapsed">
      <!-- Loading -->
      <div
        v-if="store.pulse.loading && !store.pulse.fetchedAt"
        class="p-8 flex items-center justify-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="size-4 animate-spin"
        />
        {{ t('common.loading') }}
      </div>

      <!-- Error -->
      <div
        v-else-if="store.pulse.error"
        class="p-8 text-center"
      >
        <p class="text-sm text-muted">
          {{ t('common.retry') }}
        </p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="store.pulse.fetchedAt && !hasActivity"
        class="p-8 text-center"
      >
        <UIcon
          name="i-lucide-calendar-off"
          class="size-10 text-dimmed mx-auto mb-3"
        />
        <p class="text-sm font-medium text-muted">
          {{ t('dashboard.pulse.empty') }}
        </p>
      </div>

      <!-- Content -->
      <template v-else-if="store.pulse.fetchedAt && totals">
        <!-- Backlog ratio -->
        <div class="px-4 pb-2">
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-bold text-highlighted">
              {{ t('dashboard.pulse.ratio', { ratio: totals.ratio }) }}
            </span>
            <span class="text-sm text-muted">
              {{ ratioLabel }}
            </span>
          </div>
          <p class="text-xs text-dimmed mt-0.5">
            {{ t('dashboard.pulse.summary', {
              resolved: totals.resolved,
              incoming: totals.incoming,
            }) }}
          </p>
        </div>

        <!-- Bar chart -->
        <div class="px-4">
          <ClientOnly>
            <VChart
              :option="option"
              :init-options="initOptions"
              autoresize
              class="w-full"
              style="height: 120px"
              @click="onChartClick"
            />
          </ClientOnly>
        </div>

        <!-- Day detail (expanded on click) -->
        <div
          v-if="selectedDay"
          class="border-t border-default"
        >
          <div class="flex items-center justify-between px-4 py-2 bg-elevated/50">
            <span class="text-xs font-medium text-highlighted">{{ selectedDayLabel }}</span>
            <button
              class="text-dimmed hover:text-muted"
              @click="selectedDayIndex = null"
            >
              <UIcon
                name="i-lucide-x"
                class="size-3.5"
              />
            </button>
          </div>

          <div class="px-4 py-2 space-y-3 max-h-64 overflow-y-auto">
            <!-- Resolved items -->
            <div v-if="selectedDay.resolvedItems.length > 0">
              <div class="flex items-center gap-1.5 mb-1.5">
                <span class="size-2 rounded-full bg-emerald-500" />
                <span class="text-[11px] font-medium text-muted">
                  {{ t('dashboard.pulse.resolved') }} ({{ selectedDay.resolved }})
                </span>
              </div>
              <div class="space-y-1">
                <NuxtLink
                  v-for="item in selectedDay.resolvedItems"
                  :key="item.url"
                  :to="pulseItemLink(item)"
                  :external="pulseItemExternal(item)"
                  :target="pulseItemExternal(item) ? '_blank' : undefined"
                  class="flex items-start gap-2 text-xs group py-0.5"
                >
                  <UIcon
                    :name="item.type === 'pr' ? 'i-lucide-git-pull-request' : 'i-lucide-circle-dot'"
                    class="size-3.5 shrink-0 mt-0.5 text-emerald-500"
                  />
                  <span class="text-muted group-hover:text-highlighted truncate">
                    <span class="text-dimmed">{{ item.repo }}#{{ item.number }}</span>
                    {{ item.title }}
                  </span>
                </NuxtLink>
              </div>
              <p
                v-if="selectedDay.resolved > selectedDay.resolvedItems.length"
                class="text-[11px] text-dimmed mt-1"
              >
                {{ t('dashboard.pulse.moreItems', { count: selectedDay.resolved - selectedDay.resolvedItems.length }) }}
              </p>
            </div>

            <!-- Incoming items -->
            <div v-if="selectedDay.incomingItems.length > 0">
              <div class="flex items-center gap-1.5 mb-1.5">
                <span class="size-2 rounded-full bg-orange-500" />
                <span class="text-[11px] font-medium text-muted">
                  {{ t('dashboard.pulse.incoming') }} ({{ selectedDay.incoming }})
                </span>
              </div>
              <div class="space-y-1">
                <NuxtLink
                  v-for="item in selectedDay.incomingItems"
                  :key="item.url"
                  :to="pulseItemLink(item)"
                  :external="pulseItemExternal(item)"
                  :target="pulseItemExternal(item) ? '_blank' : undefined"
                  class="flex items-start gap-2 text-xs group py-0.5"
                >
                  <UIcon
                    :name="item.type === 'pr' ? 'i-lucide-git-pull-request' : 'i-lucide-circle-dot'"
                    class="size-3.5 shrink-0 mt-0.5 text-orange-500"
                  />
                  <span class="text-muted group-hover:text-highlighted truncate">
                    <span class="text-dimmed">{{ item.repo }}#{{ item.number }}</span>
                    {{ item.title }}
                  </span>
                </NuxtLink>
              </div>
              <p
                v-if="selectedDay.incoming > selectedDay.incomingItems.length"
                class="text-[11px] text-dimmed mt-1"
              >
                {{ t('dashboard.pulse.moreItems', { count: selectedDay.incoming - selectedDay.incomingItems.length }) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex items-center gap-3 px-4 py-3 border-t border-default">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="flex items-center gap-1.5 text-xs text-muted"
          >
            <UIcon
              :name="stat.icon"
              :class="['size-3.5 shrink-0', stat.color]"
            />
            <span class="font-medium text-highlighted">{{ stat.value }}</span>
            <span>{{ stat.label }}</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
