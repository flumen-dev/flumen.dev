<script lang="ts" setup>
import { TaskItem, TaskList } from '@tiptap/extension-list'

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
const taskListExtensions = [TaskList, TaskItem]
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
  <div v-if="mode === 'write'">
    <UEditor
      v-slot="{ editor }"
      v-model="model"
      content-type="markdown"
      :mention="false"
      :extensions="taskListExtensions"
      class="w-full min-h-60 max-h-96 overflow-y-auto rounded-md border border-default"
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
    :rows="12"
    autoresize
    class="w-full font-mono text-sm"
    @keydown.meta.enter="emit('submit')"
    @keydown.ctrl.enter="emit('submit')"
  />

  <!-- Preview -->
  <div
    v-if="mode === 'preview'"
    class="min-h-60"
  >
    <UiMarkdownRenderer
      v-if="model.trim()"
      :source="model"
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
  min-height: 200px;
  padding: 0.75rem;
  outline: none;
}

:deep(ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0.25rem;

  li[data-checked] {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;

    > label {
      flex-shrink: 0;
      margin-top: 0.2rem;

      > span { display: none; }
    }

    > div {
      flex: 1;
      min-width: 0;
    }

    input[type="checkbox"] {
      appearance: none;
      width: 1.125rem;
      height: 1.125rem;
      flex-shrink: 0;
      border: 2px solid var(--ui-border);
      border-radius: 0.25rem;
      background-color: var(--ui-bg);
      cursor: pointer;
      display: grid;
      place-content: center;

      &:hover { border-color: var(--ui-color-primary); }

      &:checked {
        background-color: var(--ui-color-primary);
        border-color: var(--ui-color-primary);

        &::after {
          content: '';
          width: 0.375rem;
          height: 0.625rem;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
      }
    }
  }
}
</style>
