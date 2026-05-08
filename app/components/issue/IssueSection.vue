<script setup lang="ts">
defineProps<{
  label: string
  count: number
  iconKey: string
  iconClass?: string
  collapsed: boolean
}>()

defineEmits<{
  toggle: []
}>()
</script>

<template>
  <section class="rounded-lg border border-default overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center gap-3 px-4 py-3 hover:bg-elevated/50 transition-colors text-left"
      :aria-expanded="!collapsed"
      @click="$emit('toggle')"
    >
      <UIcon
        :name="iconKey"
        class="size-4 shrink-0"
        :class="iconClass"
      />
      <span class="text-sm font-medium text-default">{{ label }}</span>
      <span class="text-xs text-muted">{{ count }}</span>
      <UIcon
        :name="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
        class="size-4 ml-auto text-muted shrink-0"
      />
    </button>
    <div
      v-if="!collapsed"
      class="divide-y divide-default border-t border-default"
    >
      <slot />
    </div>
  </section>
</template>
