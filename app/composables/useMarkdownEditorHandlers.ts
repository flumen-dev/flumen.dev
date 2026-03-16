import { uploadImage } from '~/utils/uploadImage'

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

function pickImageAndUpload(onSelect: (src: string) => void, onError?: (error: Error) => void) {
  if (!import.meta.client) return

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    try {
      const url = await uploadImage(file)
      onSelect(url)
    }
    catch (e) {
      onError?.(e instanceof Error ? e : new Error('Upload failed'))
    }
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
        pickImageAndUpload((src) => {
          editor.chain().focus().setImage({ src }).run()
        }, () => {
          toast.add({ title: t('editor.imageUploadError'), color: 'error' })
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
