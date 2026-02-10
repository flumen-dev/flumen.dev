<script setup lang="ts">
const props = defineProps<{
  weeks: number[]
}>()

const initOptions = { width: 80, height: 20, renderer: 'svg' as const }

const option = computed(() => ({
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
      style="width: 80px; height: 20px;"
    />
  </ClientOnly>
</template>
