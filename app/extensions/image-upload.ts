import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { uploadImage } from '~/utils/uploadImage'

function getImageFile(dt: DataTransfer): File | null {
  for (const file of dt.files) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

interface ImageUploadOptions {
  onError?: (error: Error) => void
}

export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: 'imageUpload',

  addOptions() {
    return {
      onError: undefined,
    }
  },

  addProseMirrorPlugins() {
    const { editor, options } = this

    function handleFile(file: File) {
      uploadImage(file)
        .then(url => editor.chain().focus().setImage({ src: url }).run())
        .catch((e) => {
          options.onError?.(e instanceof Error ? e : new Error('Upload failed'))
        })
    }

    return [
      new Plugin({
        key: new PluginKey('imageUpload'),
        props: {
          handleDrop(_, event) {
            const file = event.dataTransfer ? getImageFile(event.dataTransfer) : null
            if (!file) return false
            event.preventDefault()
            handleFile(file)
            return true
          },
          handlePaste(_, event) {
            const file = event.clipboardData ? getImageFile(event.clipboardData) : null
            if (!file) return false
            event.preventDefault()
            handleFile(file)
            return true
          },
        },
      }),
    ]
  },
})
