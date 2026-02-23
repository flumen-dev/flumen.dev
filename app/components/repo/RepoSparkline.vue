<script setup lang="ts">
import type { EChartsInitOpts } from 'echarts'
import type { ECBasicOption } from 'echarts/types/dist/shared'

const props = withDefaults(defineProps<{
  weeks: number[]
  compact?: boolean
  height?: number
}>(), {
  compact: true,
  height: 20,
})

const initOptions = computed<EChartsInitOpts>(() => ({
  renderer: 'svg' as const,
  height: props.height,
  width: props.compact ? 80 : undefined,
}))

const option = computed<ECBasicOption>(() => ({
  grid: { top: 0, right: 0, bottom: 0, left: 0 },
  xAxis: { show: false, type: 'category' as const },
  yAxis: { show: false, type: 'value' as const, min: 0 },
  series: [{
    type: 'line' as const,
    data: props.weeks,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 1.5 },
    areaStyle: { opacity: 0.15 },
  }],
}))
</script>

<template>
  <ClientOnly>
    <VChart
      :option="option"
      :init-options="initOptions"
      autoresize
    />
  </ClientOnly>
</template>
