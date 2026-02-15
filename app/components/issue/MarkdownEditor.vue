<script lang="ts" setup>
const model = defineModel<string>({ default: '' })

defineProps<{
  placeholder?: string
}>()

const emit = defineEmits<{
  submit: []
}>()

const { t } = useI18n()

const mode = ref<'write' | 'code' | 'preview'>('write')
const toolbarItems = computed(() => getMarkdownToolbarItems(t))
const enhancedPreview = computed(() => linkifyMentions(model.value))
</script>

<template>
  <!-- Tabs -->
  <div class="flex items-center gap-1 border-b border-default mb-3">
    <button
      class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
      :class="mode === 'write'
        ? 'text-highlighted border-b-2 border-primary'
        : 'text-muted hover:text-highlighted'"
      @click="mode = 'write'"
    >
      <UIcon
        name="i-lucide-pencil"
        class="size-3.5 mr-1 align-text-bottom"
      />
      {{ t('issues.comment.write') }}
    </button>
    <button
      class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
      :class="mode === 'code'
        ? 'text-highlighted border-b-2 border-primary'
        : 'text-muted hover:text-highlighted'"
      @click="mode = 'code'"
    >
      <UIcon
        name="i-lucide-code"
        class="size-3.5 mr-1 align-text-bottom"
      />
      {{ t('editor.markdown') }}
    </button>
    <button
      class="px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
      :class="mode === 'preview'
        ? 'text-highlighted border-b-2 border-primary'
        : 'text-muted hover:text-highlighted'"
      @click="mode = 'preview'"
    >
      <UIcon
        name="i-lucide-eye"
        class="size-3.5 mr-1 align-text-bottom"
      />
      {{ t('issues.comment.preview') }}
    </button>
  </div>

  <!-- Write (WYSIWYG) -->
  <div v-show="mode === 'write'">
    <UEditor
      v-slot="{ editor }"
      v-model="model"
      content-type="markdown"
      :mention="false"
      class="w-full min-h-37.5 max-h-96 overflow-y-auto rounded-md border border-default"
      @keydown.meta.enter="emit('submit')"
      @keydown.ctrl.enter="emit('submit')"
    >
      <UEditorToolbar
        :editor="editor"
        :items="toolbarItems"
      />
    </UEditor>
  </div>

  <!-- Code (raw markdown) -->
  <UTextarea
    v-if="mode === 'code'"
    v-model="model"
    :placeholder="placeholder ?? t('issues.comment.placeholder')"
    :rows="8"
    autoresize
    class="w-full font-mono text-sm"
    @keydown.meta.enter="emit('submit')"
    @keydown.ctrl.enter="emit('submit')"
  />

  <!-- Preview -->
  <div
    v-if="mode === 'preview'"
    class="min-h-37.5"
  >
    <UEditor
      v-if="model.trim()"
      :model-value="enhancedPreview"
      content-type="markdown"
      :editable="false"
      :mention="false"
      :extensions="[LinkEnhancer]"
    />
    <p
      v-else
      class="text-sm text-muted italic py-4"
    >
      {{ t('issues.comment.previewEmpty') }}
    </p>
  </div>
</template>

<style scoped>
:deep(.tiptap) {
  min-height: 120px;
  padding: 0.75rem;
  outline: none;
}
</style>
