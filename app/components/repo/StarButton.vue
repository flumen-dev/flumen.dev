<script setup lang="ts">
const props = withDefaults(defineProps<{
  repo: string
  showCount?: boolean
}>(), {
  showCount: false,
})

const { t } = useI18n()
const starStore = useStarStore()

// Register this repo for batch fetching
starStore.request(props.repo)
watch(() => props.repo, r => starStore.request(r))

const starred = computed(() => starStore.isStarred(props.repo))
const count = computed(() => starStore.starCount(props.repo))
const loaded = computed(() => starStore.isLoaded(props.repo))
const pending = computed(() => starStore.isPending(props.repo))
const loading = computed(() => starStore.isLoading(props.repo))
const errored = computed(() => starStore.hasFailed(props.repo))
const label = computed(() => starred.value ? t('repos.unstar') : t('repos.star'))

function onClick(e: Event) {
  e.stopPropagation()
  starStore.toggleStar(props.repo)
}
</script>

<template>
  <!-- Loading spinner -->
  <span
    v-if="loading && !loaded"
    class="inline-flex items-center gap-1 text-xs text-dimmed"
  >
    <UIcon
      name="i-lucide-loader-2"
      class="size-3.5 animate-spin"
    />
  </span>

  <!-- Loaded or errored — show interactive button -->
  <UTooltip
    v-else-if="loaded || errored"
    :text="label"
  >
    <button
      class="inline-flex items-center gap-1 text-xs transition-colors cursor-pointer"
      :class="[
        starred
          ? 'text-amber-400 hover:text-amber-300'
          : 'text-toned hover:text-amber-400',
        pending ? 'opacity-60 pointer-events-none' : '',
      ]"
      :disabled="!loaded"
      :aria-label="label"
      @click="onClick"
    >
      <UIcon
        name="i-lucide-star"
        class="size-3.5"
      />
      <span v-if="showCount && count">{{ count }}</span>
    </button>
  </UTooltip>
</template>
