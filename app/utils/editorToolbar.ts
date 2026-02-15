import type { EditorToolbarItem } from '@nuxt/ui'

export const markdownToolbarItems: EditorToolbarItem[][] = [
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } },
  ],
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: 'Headings' },
      content: { align: 'start' },
      items: [
        { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'H1' },
        { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'H2' },
        { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'H3' },
      ],
    },
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bullet list' } },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Numbered list' } },
    { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } },
  ],
  [
    { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: 'Inline code' } },
    { kind: 'codeBlock', icon: 'i-lucide-square-code', tooltip: { text: 'Code block' } },
    { kind: 'horizontalRule', icon: 'i-lucide-separator-horizontal', tooltip: { text: 'Divider' } },
    { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Link' } },
  ],
]
