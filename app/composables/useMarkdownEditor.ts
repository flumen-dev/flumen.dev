import type { EditorEmojiMenuItem, EditorMentionMenuItem, EditorSuggestionMenuItem, EditorToolbarItem } from '@nuxt/ui'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { GitHubReference } from '~/extensions/github-reference'
import { CommitShaLink } from '~/extensions/commit-sha-link'

const lowlight = createLowlight(common)

const DEFAULT_EMOJI_ITEMS: EditorEmojiMenuItem[] = [
  { name: 'thumbs up', emoji: '👍', shortcodes: ['+1', 'thumbsup'], tags: ['approve', 'ok', 'like'] },
  { name: 'thumbs down', emoji: '👎', shortcodes: ['-1', 'thumbsdown'], tags: ['disapprove', 'no'] },
  { name: 'rocket', emoji: '🚀', shortcodes: ['rocket'], tags: ['ship', 'launch', 'deploy'] },
  { name: 'sparkles', emoji: '✨', shortcodes: ['sparkles'], tags: ['new', 'improve'] },
  { name: 'fire', emoji: '🔥', shortcodes: ['fire'], tags: ['hot', 'great'] },
  { name: 'eyes', emoji: '👀', shortcodes: ['eyes'], tags: ['review', 'watch'] },
  { name: 'thinking face', emoji: '🤔', shortcodes: ['thinking'], tags: ['question', 'consider'] },
  { name: 'grinning face', emoji: '😀', shortcodes: ['grinning'], tags: ['happy', 'smile'] },
  { name: 'winking face', emoji: '😉', shortcodes: ['wink'], tags: ['playful'] },
  { name: 'party popper', emoji: '🎉', shortcodes: ['tada', 'party_popper'], tags: ['celebrate', 'success'] },
  { name: 'white check mark', emoji: '✅', shortcodes: ['white_check_mark'], tags: ['done', 'complete'] },
  { name: 'cross mark', emoji: '❌', shortcodes: ['x'], tags: ['fail', 'error'] },
  { name: 'warning', emoji: '⚠️', shortcodes: ['warning'], tags: ['alert', 'caution'] },
  { name: 'bug', emoji: '🐛', shortcodes: ['bug'], tags: ['issue', 'defect'] },
  { name: 'wrench', emoji: '🔧', shortcodes: ['wrench'], tags: ['fix', 'tool'] },
  { name: 'memo', emoji: '📝', shortcodes: ['memo'], tags: ['note', 'write'] },
  { name: 'link', emoji: '🔗', shortcodes: ['link'], tags: ['url', 'reference'] },
  { name: 'package', emoji: '📦', shortcodes: ['package'], tags: ['release', 'build'] },
  { name: 'hourglass done', emoji: '⌛', shortcodes: ['hourglass'], tags: ['waiting', 'pending'] },
  { name: 'red heart', emoji: '❤️', shortcodes: ['heart'], tags: ['love', 'thanks'] },
]

export function useMarkdownEditor(options: {
  repoContext?: string
  mentionUsers?: MaybeRef<MentionUser[] | undefined>
} = {}) {
  const { t } = useI18n()

  const extensions = [
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({ lowlight }),
    GitHubReference.configure({
      issueUrlPrefix: options.repoContext ? `https://github.com/${options.repoContext}/issues/` : '#',
    }),
    CommitShaLink.configure({
      commitUrlPrefix: options.repoContext ? `https://github.com/${options.repoContext}/commit/` : '',
    }),
  ]

  const toolbarItems = computed<EditorToolbarItem[][]>(() => [
    [
      {
        icon: 'i-lucide-heading',
        tooltip: { text: t('editor.toolbar.headings') },
        content: { align: 'start' as const },
        items: [
          { kind: 'heading' as const, level: 1, icon: 'i-lucide-heading-1', label: t('editor.toolbar.heading1') },
          { kind: 'heading' as const, level: 2, icon: 'i-lucide-heading-2', label: t('editor.toolbar.heading2') },
          { kind: 'heading' as const, level: 3, icon: 'i-lucide-heading-3', label: t('editor.toolbar.heading3') },
        ],
      },
    ],
    [
      { kind: 'mark' as const, mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: t('editor.toolbar.bold') } },
      { kind: 'mark' as const, mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: t('editor.toolbar.italic') } },
      { kind: 'mark' as const, mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: t('editor.toolbar.strikethrough') } },
      { kind: 'mark' as const, mark: 'code', icon: 'i-lucide-code', tooltip: { text: t('editor.toolbar.inlineCode') } },
    ],
    [
      { kind: 'link' as const, icon: 'i-lucide-link', tooltip: { text: t('editor.toolbar.link') } },
      { kind: 'image' as const, icon: 'i-lucide-image', tooltip: { text: t('editor.toolbar.image') } },
      { kind: 'emoji' as const, icon: 'i-lucide-smile' },
    ],
    [
      { kind: 'bulletList' as const, icon: 'i-lucide-list', tooltip: { text: t('editor.toolbar.bulletList') } },
      { kind: 'orderedList' as const, icon: 'i-lucide-list-ordered', tooltip: { text: t('editor.toolbar.orderedList') } },
      { kind: 'taskList' as const, icon: 'i-lucide-list-checks', tooltip: { text: t('editor.toolbar.taskList') } },
    ],
    [
      { kind: 'blockquote' as const, icon: 'i-lucide-text-quote', tooltip: { text: t('editor.toolbar.blockquote') } },
      { kind: 'codeBlock' as const, icon: 'i-lucide-square-code', tooltip: { text: t('editor.toolbar.codeBlock') } },
      { kind: 'horizontalRule' as const, icon: 'i-lucide-separator-horizontal', tooltip: { text: t('editor.toolbar.divider') } },
    ],
    [
      { kind: 'undo' as const, icon: 'i-lucide-undo', tooltip: { text: t('editor.toolbar.undo') } },
      { kind: 'redo' as const, icon: 'i-lucide-redo', tooltip: { text: t('editor.toolbar.redo') } },
    ],
  ])

  const suggestionItems = computed<EditorSuggestionMenuItem[][]>(() => [
    [
      { type: 'label' as const, label: t('editor.suggestion.text') },
      { kind: 'paragraph' as const, label: t('editor.suggestion.paragraph'), icon: 'i-lucide-type' },
      { kind: 'heading' as const, level: 1, label: t('editor.suggestion.heading1'), icon: 'i-lucide-heading-1' },
      { kind: 'heading' as const, level: 2, label: t('editor.suggestion.heading2'), icon: 'i-lucide-heading-2' },
      { kind: 'heading' as const, level: 3, label: t('editor.suggestion.heading3'), icon: 'i-lucide-heading-3' },
    ],
    [
      { type: 'label' as const, label: t('editor.suggestion.lists') },
      { kind: 'bulletList' as const, label: t('editor.suggestion.bulletList'), icon: 'i-lucide-list' },
      { kind: 'orderedList' as const, label: t('editor.suggestion.orderedList'), icon: 'i-lucide-list-ordered' },
      { kind: 'taskList' as const, label: t('editor.suggestion.taskList'), icon: 'i-lucide-list-checks' },
    ],
    [
      { type: 'label' as const, label: t('editor.suggestion.insert') },
      { kind: 'image' as const, label: t('editor.toolbar.image'), icon: 'i-lucide-image' },
      { kind: 'blockquote' as const, label: t('editor.suggestion.blockquote'), icon: 'i-lucide-text-quote' },
      { kind: 'codeBlock' as const, label: t('editor.suggestion.codeBlock'), icon: 'i-lucide-square-code' },
      { kind: 'horizontalRule' as const, label: t('editor.suggestion.divider'), icon: 'i-lucide-separator-horizontal' },
    ],
  ])

  const mentionItems = computed<EditorMentionMenuItem[]>(() => {
    const users = toValue(options.mentionUsers)
    if (!users) return []
    return users.map(u => ({
      label: u.label,
      avatar: u.avatar,
    }))
  })

  const emojiItems = computed<EditorEmojiMenuItem[]>(() => DEFAULT_EMOJI_ITEMS)

  return {
    extensions,
    toolbarItems,
    suggestionItems,
    mentionItems,
    emojiItems,
  }
}
