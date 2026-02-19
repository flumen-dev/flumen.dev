<script setup lang="ts">
import type { MarkdownEditorProps } from '~~/shared/types/editor'

const props = withDefaults(defineProps<MarkdownEditorProps>(), {
  placeholder: '',
  minHeight: '10rem',
  mentionUsers: () => [],
  framed: true,
  showHeader: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': []
  'blur': []
}>()

const { t } = useI18n()

const mode = ref<MarkdownEditorMode>('wysiwyg')

const content = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const sourceContent = computed({
  get: () => normalizeMarkdownMentions(content.value),
  set: (value: string) => {
    content.value = value
  },
})

const {
  extensions,
  toolbarItems,
  suggestionItems,
  mentionItems,
  emojiItems,
} = useMarkdownEditor({
  repoContext: props.repoContext,
  mentionUsers: props.mentionUsers,
})

const editedTimeAgo = computed(() => {
  if (props.updatedAt && props.createdAt && props.updatedAt !== props.createdAt) {
    return useTimeAgo(computed(() => props.updatedAt!))
  }

  return null
})

const placeholderText = computed(() => props.placeholder || t('editor.placeholder'))

const minHeightRef = toRef(props, 'minHeight')
const editorContainerRef = useTemplateRef<HTMLDivElement>('editorContainer')
const sourceRef = useTemplateRef<HTMLTextAreaElement>('sourceTextarea')
const { issueSuggestionItems } = useIssueReferenceSuggestions(toRef(props, 'repoContext'))
const { editorHeight } = useEditorPaneHeight({
  minHeight: minHeightRef,
  mode,
  editorContainerRef,
  sourceRef,
})

/** Handle Ctrl+Enter to submit */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    emit('submit')
  }
}

function setMode(value: MarkdownEditorMode) {
  mode.value = value
}

function onFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget

  if (!(currentTarget instanceof HTMLElement)) {
    return
  }

  const nextTarget = event.relatedTarget

  if (nextTarget instanceof Node && currentTarget.contains(nextTarget)) {
    return
  }

  emit('blur')
}

const { editorHandlers } = useMarkdownEditorHandlers()

const appendToBody = import.meta.client
  ? () => document.body
  : undefined
</script>

<template>
  <div
    class="overflow-hidden"
    :class="[
      props.framed ? 'rounded-md border border-default bg-default' : '',
    ]"
    @focusout="onFocusOut"
  >
    <!-- Header bar: mode toggle + edited indicator -->
    <div
      v-if="props.showHeader"
      class="flex items-center justify-between px-3 py-2 border-b border-default bg-muted/50"
    >
      <slot
        name="header-left"
        :mode="mode"
        :set-mode="setMode"
      >
        <EditorSourceToggle v-model="mode" />
      </slot>

      <slot
        name="header-right"
        :mode="mode"
      >
        <span
          v-if="editedTimeAgo?.value"
          class="text-xs text-dimmed flex items-center gap-1"
        >
          <UIcon
            name="i-lucide-pencil"
            class="size-3"
          />
          {{ t('editor.editedAgo', { time: editedTimeAgo.value }) }}
        </span>
      </slot>
    </div>

    <!-- WYSIWYG mode -->
    <div
      v-show="mode === 'wysiwyg'"
      ref="editorContainer"
      :style="{ minHeight: props.minHeight, height: editorHeight }"
      class="overflow-y-auto resize-y"
    >
      <UEditor
        v-slot="{ editor }"
        v-model="content"
        content-type="markdown"
        :editable="true"
        :placeholder="placeholderText"
        :extensions="extensions"
        :handlers="editorHandlers"
        :starter-kit="{ codeBlock: false }"
        :ui="{ base: 'markdown-content p-4' }"
        class="w-full"
        @keydown="onKeyDown"
      >
        <UEditorToolbar
          :editor="editor"
          :items="toolbarItems"
          class="border-b border-default py-1.5 px-3 overflow-x-auto sticky top-0 z-10 bg-default"
        />

        <UEditorSuggestionMenu
          :editor="editor"
          :items="suggestionItems"
          :append-to="appendToBody"
          :options="{ strategy: 'fixed' }"
        />

        <UEditorSuggestionMenu
          v-if="issueSuggestionItems.length > 0"
          :editor="editor"
          :items="issueSuggestionItems"
          char="#"
          plugin-key="issueReferenceMenu"
          :append-to="appendToBody"
          :options="{ strategy: 'fixed' }"
        />

        <UEditorEmojiMenu
          :editor="editor"
          :items="emojiItems"
          :append-to="appendToBody"
          :options="{ strategy: 'fixed' }"
        />

        <UEditorMentionMenu
          v-if="mentionItems.length > 0"
          :editor="editor"
          :items="mentionItems"
          :append-to="appendToBody"
          :options="{ strategy: 'fixed' }"
        />

        <UEditorDragHandle
          :editor="editor"
          :options="{ strategy: 'absolute', flip: false, shift: false }"
          :ui="{
            root: 'hidden sm:flex items-center justify-center transition-none! duration-0!',
            handle: 'shrink-0 bg-accented! transition-none!',
          }"
        />
      </UEditor>
    </div>

    <!-- Source mode -->
    <div
      v-show="mode === 'source'"
    >
      <textarea
        ref="sourceTextarea"
        v-model="sourceContent"
        :placeholder="placeholderText"
        :style="{ minHeight: props.minHeight, height: editorHeight }"
        class="w-full p-4 bg-transparent text-sm font-mono text-default outline-none resize-y"
        @keydown="onKeyDown"
      />
    </div>
  </div>
</template>
