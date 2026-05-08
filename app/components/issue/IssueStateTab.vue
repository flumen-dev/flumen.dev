<script setup lang="ts">
defineProps<{
  label: string
  active: boolean
  loading: boolean
  count: number | null
  iconKey: string
}>()

defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    class="inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed"
    :class="active ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
    :disabled="loading"
    @click="$emit('select')"
  >
    <UIcon
      :name="loading && active ? 'i-lucide-loader-circle' : iconKey"
      class="size-4"
      :class="loading && active ? 'animate-spin' : ''"
    />
    {{ label }}
    <span
      v-if="count !== null"
      class="text-xs text-muted"
    >({{ count }})</span>
  </button>
</template>
