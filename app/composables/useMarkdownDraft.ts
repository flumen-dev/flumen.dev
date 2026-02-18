interface UseMarkdownDraftOptions {
  key: MaybeRef<string | null | undefined>
  value: Ref<string>
  enabled?: MaybeRef<boolean>
  onRestored?: (value: string) => void
}

interface DiscardDraftOptions {
  resetToBaseline?: boolean
}

const DRAFT_PREFIX = 'flumen:markdown-draft:'

function normalizeDraftValue(value: string) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('\u00A0', ' ')
    .replaceAll('\u200B', '')
    .trim()
}

export function hasMeaningfulMarkdown(value: string) {
  return !!normalizeDraftValue(value)
}

export function useMarkdownDraft(options: UseMarkdownDraftOptions) {
  const enabled = computed(() => toValue(options.enabled) !== false)
  const storageKey = computed(() => {
    const key = toValue(options.key)
    return key ? `${DRAFT_PREFIX}${key}` : null
  })

  const baseline = ref(options.value.value)
  const hasDraft = ref(false)
  const didInit = ref(false)

  function removeStoredDraft() {
    if (!import.meta.client || !storageKey.value) return
    localStorage.removeItem(storageKey.value)
    hasDraft.value = false
  }

  function saveDraftIfNeeded(value: string) {
    if (!import.meta.client || !storageKey.value || !enabled.value || !didInit.value) return

    const normalizedValue = normalizeDraftValue(value)
    const normalizedBaseline = normalizeDraftValue(baseline.value)

    if (!normalizedValue || normalizedValue === normalizedBaseline) {
      removeStoredDraft()
      return
    }

    localStorage.setItem(storageKey.value, value)
    hasDraft.value = true
  }

  function initForContext() {
    if (!import.meta.client || !storageKey.value || !enabled.value) return

    baseline.value = options.value.value
    didInit.value = true

    const stored = localStorage.getItem(storageKey.value)
    const storedValue = stored ?? ''
    const normalizedStored = normalizeDraftValue(storedValue)
    const normalizedBaseline = normalizeDraftValue(baseline.value)

    if (!normalizedStored || normalizedStored === normalizedBaseline) {
      if (stored) {
        removeStoredDraft()
      }
      hasDraft.value = false
      return
    }

    options.value.value = storedValue
    hasDraft.value = true
    options.onRestored?.(storedValue)
  }

  function discardDraft(opts: DiscardDraftOptions = {}) {
    const { resetToBaseline = true } = opts
    removeStoredDraft()

    if (resetToBaseline) {
      options.value.value = baseline.value
    }
  }

  function markSavedBaseline() {
    baseline.value = options.value.value
    removeStoredDraft()
  }

  watch(
    [storageKey, enabled],
    () => {
      if (!import.meta.client) return
      if (!enabled.value) {
        didInit.value = false
        hasDraft.value = false
        return
      }
      initForContext()
    },
    { immediate: true },
  )

  watch(
    options.value,
    (value) => {
      saveDraftIfNeeded(value)
    },
  )

  return {
    hasDraft: readonly(hasDraft),
    discardDraft,
    markSavedBaseline,
  }
}
