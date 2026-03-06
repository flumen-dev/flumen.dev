<script lang="ts" setup>
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  confirm: []
}>()

const { t } = useI18n()
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2">
          {{ t('workItems.timeline.confirmDeleteTitle') }}
        </h3>
        <p class="text-sm text-muted mb-4">
          {{ t('workItems.timeline.confirmDeleteDescription') }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <UButton
            :label="t('workItems.timeline.deleteComment')"
            color="error"
            icon="i-lucide-trash-2"
            @click="open = false; emit('confirm')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
