<script setup lang="ts">
import { shortcodeToUnicode } from '~~/shared/types/status'

withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const { t } = useI18n()
const profileStore = useProfileStore()

const status = computed(() => profileStore.status)
const emojiDisplay = computed(() => shortcodeToUnicode(status.value?.emoji ?? null))
const hasStatus = computed(() => status.value?.emoji || status.value?.message)

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const remaining = computed(() => {
  const expiresAt = status.value?.expiresAt
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - now.value.getTime()
  if (diff <= 0) return null
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return t('status.remaining.minutes', { count: mins })
  const hours = Math.round(mins / 60)
  return t('status.remaining.hours', { count: hours })
})
</script>

<template>
  <div
    v-if="hasStatus"
    class="flex items-center gap-1.5 min-w-0"
    :class="compact ? 'text-xs' : 'text-sm'"
  >
    <span
      v-if="emojiDisplay"
      class="shrink-0"
    >
      {{ emojiDisplay }}
    </span>
    <span class="truncate text-muted">
      {{ status?.message }}
    </span>
    <span
      v-if="remaining"
      class="shrink-0 text-dimmed"
    >
      · {{ remaining }}
    </span>
  </div>
</template>
