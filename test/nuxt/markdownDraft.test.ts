import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useMarkdownDraft } from '../../app/composables/useMarkdownDraft'

async function withDraftHarness(options: {
  key: string
  initialValue?: string
  enabled?: boolean
  storedValue?: string
}) {
  let api: {
    value: ReturnType<typeof ref<string>>
    hasDraft: ReturnType<typeof ref<boolean>>
    discardDraft: (opts?: { resetToBaseline?: boolean }) => void
    markSavedBaseline: () => void
    restoredValues: string[]
  } | null = null

  if (options.storedValue !== undefined) {
    localStorage.setItem(`flumen:markdown-draft:${options.key}`, options.storedValue)
  }
  else {
    localStorage.removeItem(`flumen:markdown-draft:${options.key}`)
  }

  const Wrapper = defineComponent({
    setup() {
      const value = ref(options.initialValue ?? '')
      const restoredValues: string[] = []
      const draft = useMarkdownDraft({
        key: options.key,
        value,
        enabled: options.enabled ?? true,
        onRestored: (restored) => {
          restoredValues.push(restored)
        },
      })

      api = {
        value,
        hasDraft: draft.hasDraft,
        discardDraft: draft.discardDraft,
        markSavedBaseline: draft.markSavedBaseline,
        restoredValues,
      }

      return () => h('div')
    },
  })

  await mountSuspended(Wrapper)
  await nextTick()
  return api!
}

describe('useMarkdownDraft', () => {
  it('restores stored draft and emits restored callback', async () => {
    const harness = await withDraftHarness({
      key: 'draft-restore',
      initialValue: '',
      storedValue: 'restored value',
    })

    expect(harness.value.value).toBe('restored value')
    expect(harness.hasDraft.value).toBe(true)
    expect(harness.restoredValues).toEqual(['restored value'])
  })

  it('does not restore draft when normalized value equals baseline', async () => {
    const harness = await withDraftHarness({
      key: 'draft-same-as-baseline',
      initialValue: 'Hello',
      storedValue: ' Hello ',
    })

    expect(harness.value.value).toBe('Hello')
    expect(harness.hasDraft.value).toBe(false)
    expect(localStorage.getItem('flumen:markdown-draft:draft-same-as-baseline')).toBeNull()
  })

  it('persists value changes and supports discard and markSavedBaseline', async () => {
    const harness = await withDraftHarness({
      key: 'draft-save-discard',
      initialValue: 'base',
    })

    harness.value.value = 'changed'
    await nextTick()
    expect(localStorage.getItem('flumen:markdown-draft:draft-save-discard')).toBe('changed')
    expect(harness.hasDraft.value).toBe(true)

    harness.discardDraft()
    await nextTick()
    expect(harness.value.value).toBe('base')
    expect(localStorage.getItem('flumen:markdown-draft:draft-save-discard')).toBeNull()

    harness.value.value = 'new baseline'
    await nextTick()
    harness.markSavedBaseline()
    await nextTick()
    expect(localStorage.getItem('flumen:markdown-draft:draft-save-discard')).toBeNull()
    expect(harness.hasDraft.value).toBe(false)
  })

  it('does not persist when disabled', async () => {
    const harness = await withDraftHarness({
      key: 'draft-disabled',
      initialValue: 'base',
      enabled: false,
    })

    harness.value.value = 'changed'
    await nextTick()
    expect(localStorage.getItem('flumen:markdown-draft:draft-disabled')).toBeNull()
    expect(harness.hasDraft.value).toBe(false)
  })
})
