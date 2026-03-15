<script lang="ts" setup>
const { t } = useI18n()
const requestFetch = useRequestFetch()

const limit = ref(0)
const remaining = ref(0)
const reset = ref(0)

const used = computed(() => limit.value - remaining.value)
const usedRatio = computed(() => limit.value > 0 ? used.value / limit.value : 0)
const percent = computed(() => Math.round(usedRatio.value * 100))
const isWarning = computed(() => usedRatio.value > 0.8)

const resetLabel = computed(() => {
  const now = Math.floor(Date.now() / 1000)
  const diff = reset.value - now
  if (diff <= 0) return t('rateLimit.resetsNow')
  const min = Math.ceil(diff / 60)
  return t('rateLimit.resetsIn', { min })
})

const barColor = computed(() => {
  if (usedRatio.value > 0.9) return 'bg-red-500'
  if (usedRatio.value > 0.8) return 'bg-warning'
  return 'bg-primary'
})

async function fetchRateLimit() {
  try {
    const data = await requestFetch<{ limit: number, remaining: number, reset: number }>('/api/github/rate-limit')
    if (data) {
      limit.value = data.limit
      remaining.value = data.remaining
      reset.value = data.reset
    }
  }
  catch {
    // Silently skip
  }
}

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchRateLimit()
  timer = setInterval(fetchRateLimit, 10_000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <UTooltip
    v-if="limit > 0"
    :text="t('rateLimit.tooltip')"
    :content="{ side: 'right' }"
  >
    <div class="px-2 py-1.5">
      <div class="flex items-center justify-between text-[10px] text-muted mb-1">
        <span :class="isWarning ? 'text-warning font-medium' : ''">
          {{ t('rateLimit.label') }}
        </span>
        <span>{{ used }}/{{ limit }}</span>
      </div>
      <div class="h-1 rounded-full bg-elevated overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="barColor"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <div class="text-[10px] text-dimmed mt-0.5">
        {{ resetLabel }}
      </div>
    </div>
  </UTooltip>
</template>
