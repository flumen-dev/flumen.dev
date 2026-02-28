<script setup lang="ts">
const props = defineProps<{
  modelValue: 'open' | 'closed' | 'all'
  allLabel: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: 'open' | 'closed' | 'all'): void
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <UButton
      size="xs"
      :variant="props.modelValue === 'open' ? 'solid' : 'outline'"
      @click="emit('update:modelValue', 'open')"
    >
      {{ $t('issues.open') }}
    </UButton>
    <UButton
      size="xs"
      :variant="props.modelValue === 'closed' ? 'solid' : 'outline'"
      @click="emit('update:modelValue', 'closed')"
    >
      {{ $t('issues.closed') }}
    </UButton>
    <UButton
      size="xs"
      :variant="props.modelValue === 'all' ? 'solid' : 'outline'"
      @click="emit('update:modelValue', 'all')"
    >
      {{ props.allLabel }}
    </UButton>
  </div>
</template>
