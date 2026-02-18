type ImageHandlerEditor = {
  can: () => {
    setImage: (options: { src: string }) => boolean
  }
  chain: () => {
    focus: () => {
      setImage: (options: { src: string }) => {
        run: () => void
      }
      insertContent: (content: string) => {
        run: () => void
      }
    }
    insertContent: (content: string) => {
      run: () => void
    }
    run: () => void
  }
  isActive: (name: string) => boolean
  extensionManager?: {
    extensions?: Array<{ name: string }>
  }
}

function pickImageAndInsert(onSelect: (src: string) => void, onError?: (error: Error) => void) {
  if (!import.meta.client) return

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'

  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelect(reader.result)
      }
    }
    reader.onerror = () => {
      const error = reader.error ?? new Error('Failed to read the selected image file.')
      onError?.(error)
    }
    reader.readAsDataURL(file)
  }

  input.click()
}

export function useMarkdownEditorHandlers() {
  const toast = useToast()
  const { t } = useI18n()

  const handlers = {
    image: {
      canExecute: (editor: ImageHandlerEditor) => editor.can().setImage({ src: '' }),
      execute: (editor: ImageHandlerEditor) => {
        pickImageAndInsert((src) => {
          editor.chain().focus().setImage({ src }).run()
        }, () => {
          toast.add({ title: t('editor.imageReadError'), color: 'error' })
        })

        return editor.chain()
      },
      isActive: (editor: ImageHandlerEditor) => editor.isActive('image'),
      isDisabled: (editor: ImageHandlerEditor) => {
        const extensions = editor.extensionManager?.extensions
        return !extensions?.some(extension => extension.name === 'image')
      },
    },
    issueReference: {
      canExecute: () => true,
      execute: (editor: ImageHandlerEditor, cmd?: { number?: number }) => {
        if (!cmd?.number) return editor.chain()
        return editor.chain().focus().insertContent(`#${cmd.number} `)
      },
      isActive: () => false,
    },
  }

  return {
    editorHandlers: handlers,
  }
}
