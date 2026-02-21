<script setup lang="ts">
defineProps<{
  currentPage: number
  totalPages: number
  hasMore: boolean
  hasPrevious: boolean
  paging?: 'next' | 'prev' | null
}>()

const emit = defineEmits<{
  next: []
  previous: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="hasPrevious || hasMore"
    class="flex items-center justify-between px-4 py-3 border-t border-default"
  >
    <UButton
      :label="t('issues.previousPage')"
      icon="i-lucide-chevron-left"
      variant="outline"
      size="sm"
      :disabled="!hasPrevious"
      :loading="paging === 'prev'"
      @click="emit('previous')"
    />
    <span class="text-sm text-muted">
      {{ t('issues.page', { current: currentPage, total: totalPages }) }}
    </span>
    <UButton
      :label="t('issues.nextPage')"
      trailing-icon="i-lucide-chevron-right"
      variant="outline"
      size="sm"
      :disabled="!hasMore"
      :loading="paging === 'next'"
      @click="emit('next')"
    />
  </div>
</template>
