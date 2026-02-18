import type { MarkdownEditorMode } from '~~/shared/types/editor'

interface UseEditorPaneHeightOptions {
  minHeight: Ref<string>
  mode: Ref<MarkdownEditorMode>
  editorContainerRef: Ref<HTMLDivElement | null>
  sourceRef: Ref<HTMLTextAreaElement | null>
}

export function useEditorPaneHeight(options: UseEditorPaneHeightOptions) {
  const editorHeight = ref(options.minHeight.value)

  function syncHeightFromWysiwyg() {
    const el = options.editorContainerRef.value
    if (el) {
      editorHeight.value = `${el.offsetHeight}px`
    }
  }

  function syncHeightFromSource() {
    const el = options.sourceRef.value
    if (el) {
      editorHeight.value = `${el.offsetHeight}px`
    }
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement
        if (target === options.editorContainerRef.value && options.mode.value === 'wysiwyg') {
          syncHeightFromWysiwyg()
        }
        else if (target === options.sourceRef.value && options.mode.value === 'source') {
          syncHeightFromSource()
        }
      }
    })

    if (options.editorContainerRef.value) resizeObserver.observe(options.editorContainerRef.value)
    if (options.sourceRef.value) resizeObserver.observe(options.sourceRef.value)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
  })

  return {
    editorHeight,
  }
}
