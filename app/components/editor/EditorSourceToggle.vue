<script setup lang="ts">
const mode = defineModel<MarkdownEditorMode>({ default: 'wysiwyg' })

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
    <UTooltip :text="t('editor.wysiwyg')">
      <UButton
        size="xs"
        :variant="mode === 'wysiwyg' ? 'solid' : 'ghost'"
        :color="mode === 'wysiwyg' ? 'primary' : 'neutral'"
        icon="i-lucide-eye"
        @click="mode = 'wysiwyg'"
      />
    </UTooltip>
    <UTooltip :text="t('editor.source')">
      <UButton
        size="xs"
        :variant="mode === 'source' ? 'solid' : 'ghost'"
        :color="mode === 'source' ? 'primary' : 'neutral'"
        icon="i-lucide-code"
        @click="mode = 'source'"
      />
    </UTooltip>
  </div>
</template>
