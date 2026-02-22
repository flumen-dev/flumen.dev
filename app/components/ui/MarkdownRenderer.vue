<script lang="ts" setup>
const props = withDefaults(defineProps<{
  /** Raw markdown source */
  source: string
  /** Repository context for GitHub issue references (owner/repo) */
  repoContext?: string
  /** Base URL for proxying raw files, rewrites relative image URLs */
  rawProxyBase?: string
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
  let md = props.linkifyMentions
    ? linkifyMentions(props.source)
    : props.source

  if (props.rawProxyBase) {
    md = rewriteRelativeUrls(md, props.rawProxyBase)
  }

  return renderMarkdown(md, props.breaks)
})

function enhance() {
  const el = container.value
  if (!el) return

  if (props.linkifyMentions) {
    enhanceMentionChips(el)
  }

  if (props.repoContext) {
    enhanceGitHubReferences(el, props.repoContext)
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
    class="markdown-content"
    v-html="html"
  />
</template>
