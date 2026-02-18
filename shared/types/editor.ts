export interface MentionUser {
  label: string
  avatar?: {
    src: string
  }
}

export interface MarkdownEditorProps {
  /** The markdown content */
  modelValue: string
  /** Placeholder text shown when empty */
  placeholder?: string
  /** ISO timestamp of when the content was last updated */
  updatedAt?: string
  /** ISO timestamp of when the content was created */
  createdAt?: string
  /** Minimum height CSS value (default: '10rem') */
  minHeight?: string
  /** Repository context for GitHub reference links (owner/repo) */
  repoContext?: string
  /** Users available for @mention suggestions */
  mentionUsers?: MentionUser[]
  /** Render editor frame (border/background/rounded), default true */
  framed?: boolean
  /** Render editor header bar, default true */
  showHeader?: boolean
}

export type MarkdownEditorMode = 'wysiwyg' | 'source'

export interface GitHubReference {
  type: 'close' | 'closes' | 'fix' | 'fixes' | 'resolve' | 'resolves'
  number: number
}
