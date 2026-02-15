import type { EditorToolbarItem } from '@nuxt/ui'

type T = (key: string) => string

export function getMarkdownToolbarItems(t: T): EditorToolbarItem[][] {
  return [
    [
      { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: t('editor.bold') } },
      { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: t('editor.italic') } },
      { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: t('editor.strikethrough') } },
    ],
    [
      {
        icon: 'i-lucide-heading',
        tooltip: { text: t('editor.headings') },
        content: { align: 'start' },
        items: [
          { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'H1' },
          { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'H2' },
          { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'H3' },
        ],
      },
      { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: t('editor.bulletList') } },
      { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: t('editor.numberedList') } },
      { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: t('editor.quote') } },
    ],
    [
      { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: t('editor.inlineCode') } },
      { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: { text: t('editor.codeBlock') } },
      { kind: 'horizontalRule', icon: 'i-lucide-separator-horizontal', tooltip: { text: t('editor.divider') } },
      { kind: 'link', icon: 'i-lucide-link', tooltip: { text: t('editor.link') } },
    ],
  ]
}
