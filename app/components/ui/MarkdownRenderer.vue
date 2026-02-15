<script lang="ts" setup>
const props = withDefaults(defineProps<{
  /** Raw markdown source */
  source: string
  /** Auto-convert @mentions to GitHub profile links */
  linkifyMentions?: boolean
  /** Make task checkboxes clickable */
  interactiveTasks?: boolean
  /** Treat single line breaks as <br> (true for comments, false for READMEs) */
  breaks?: boolean
}>(), {
  linkifyMentions: true,
  interactiveTasks: false,
  breaks: true,
})

const emit = defineEmits<{
  'task-toggle': [detail: TaskToggleDetail]
}>()

const container = useTemplateRef<HTMLDivElement>('container')

const html = computed(() => {
  const md = props.linkifyMentions
    ? linkifyMentions(props.source)
    : props.source
  return renderMarkdown(md, props.breaks)
})

function enhance() {
  const el = container.value
  if (!el) return

  if (props.linkifyMentions) {
    enhanceMentionChips(el)
  }

  if (props.interactiveTasks) {
    enableInteractiveCheckboxes(el, detail => emit('task-toggle', detail))
  }
}

onMounted(enhance)
watch(html, () => nextTick(enhance))
</script>

<template>
  <div
    ref="container"
    class="markdown-body"
    v-html="html"
  />
</template>

<style scoped>
.markdown-body {
  font-size: 0.875rem;
  line-height: 1.625;
  color: var(--ui-text);
  word-wrap: break-word;

  :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid var(--ui-border); padding-bottom: 0.25rem; }
  :deep(h2) { font-size: 1.25rem; font-weight: 700; margin: 1.25rem 0 0.625rem; border-bottom: 1px solid var(--ui-border); padding-bottom: 0.25rem; }
  :deep(h3) { font-size: 1.125rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  :deep(h4) { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.375rem; }

  :deep(p) { margin: 0.5rem 0; }
  :deep(p:first-child) { margin-top: 0; }
  :deep(p:last-child) { margin-bottom: 0; }

  :deep(a) { color: var(--ui-color-primary); text-decoration: none; }
  :deep(a:hover) { text-decoration: underline; }
  :deep(a > img) { display: inline; }

  :deep(ul),
  :deep(ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
  :deep(li) { margin: 0.25rem 0; }

  :deep(blockquote) {
    border-left: 3px solid var(--ui-border);
    padding: 0.25rem 1rem;
    margin: 0.5rem 0;
    color: var(--ui-text-muted);
  }

  :deep(code) {
    background-color: var(--ui-bg-muted);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }

  :deep(pre) {
    background-color: var(--ui-bg-elevated);
    border: 1px solid var(--ui-border);
    border-radius: 0.375rem;
    padding: 0.75rem 1rem;
    margin: 0.75rem 0;
    overflow-x: auto;

    code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 0.8125rem;
    }
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75rem 0;
  }

  :deep(th),
  :deep(td) {
    border: 1px solid var(--ui-border);
    padding: 0.375rem 0.75rem;
    text-align: left;
  }

  :deep(th) {
    background-color: var(--ui-bg-elevated);
    font-weight: 600;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid var(--ui-border);
    margin: 1rem 0;
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 0.375rem;
  }

  :deep(details) {
    border: 1px solid var(--ui-border);
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    margin: 0.5rem 0;
  }

  :deep(summary) {
    cursor: pointer;
    font-weight: 500;
  }
}
</style>
