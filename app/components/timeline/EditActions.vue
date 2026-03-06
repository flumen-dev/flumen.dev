<script lang="ts" setup>
defineProps<{
  canUpdate?: boolean
  canDelete?: boolean
  editDisabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="canUpdate || canDelete"
    class="flex items-center gap-1.5"
  >
    <UTooltip
      v-if="canUpdate"
      :text="t('workItems.timeline.editComment')"
    >
      <UButton
        icon="i-lucide-pencil"
        :size="size ?? 'xs'"
        color="neutral"
        variant="ghost"
        square
        :disabled="editDisabled"
        :aria-label="t('workItems.timeline.editComment')"
        @click="emit('edit')"
      />
    </UTooltip>
    <UTooltip
      v-if="canDelete"
      :text="t('workItems.timeline.deleteComment')"
    >
      <UButton
        icon="i-lucide-trash-2"
        :size="size ?? 'xs'"
        color="error"
        variant="ghost"
        square
        :aria-label="t('workItems.timeline.deleteComment')"
        @click="emit('delete')"
      />
    </UTooltip>
  </div>
</template>
