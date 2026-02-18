import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { createGitHubReferenceRegex, GITHUB_REFERENCE_INPUT_REGEX, parseGitHubReference } from '~/utils/githubReferences'

/**
 * TipTap mark extension that detects GitHub-style issue reference keywords
 * like `close #123`, `closes #123`, `fix #456`, `fixes #456`,
 * `resolve #789`, `resolves #789` and renders them as
 * styled inline chips with clickable links.
 *
 * Uses both input/paste rules (for typed/pasted content) and a ProseMirror
 * decoration plugin (for content loaded from the initial value).
 */

const githubRefPluginKey = new PluginKey('githubRefDecoration')

interface GitHubReferenceOptions {
  /** Base URL prefix for issue links. Defaults to '#' (no navigation). */
  issueUrlPrefix: string
  /** HTML attributes to add to the rendered element */
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    githubReference: {
      setGitHubReference: (attrs: { type: string, number: number }) => ReturnType
      unsetGitHubReference: () => ReturnType
    }
  }
}

export const GitHubReference = Mark.create<GitHubReferenceOptions>({
  name: 'githubReference',

  addOptions() {
    return {
      issueUrlPrefix: '#',
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-ref-type'),
        renderHTML: (attributes: Record<string, string>) => {
          if (!attributes.type) return {}
          return { 'data-ref-type': attributes.type }
        },
      },
      number: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-ref-number'),
        renderHTML: (attributes: Record<string, string>) => {
          if (!attributes.number) return {}
          return { 'data-ref-number': attributes.number }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-github-ref]' },
    ]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['span', mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
      {
        'data-github-ref': '',
        'class': 'github-ref',
      },
    ), 0]
  },

  addInputRules() {
    return [
      markInputRule({
        find: GITHUB_REFERENCE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match: RegExpMatchArray) => {
          const parsed = parseGitHubReference(match[0] || '')
          return {
            type: parsed?.keyword,
            number: parsed?.number,
          }
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: createGitHubReferenceRegex('gi'),
        type: this.type,
        getAttributes: (match: RegExpMatchArray) => {
          const parsed = parseGitHubReference(match[0] || '')
          return {
            type: parsed?.keyword,
            number: parsed?.number,
          }
        },
      }),
    ]
  },

  addCommands() {
    return {
      setGitHubReference: (attrs: { type: string, number: number }) => ({ commands }: { commands: { setMark: (name: string, attrs: Record<string, unknown>) => boolean } }) => {
        return commands.setMark(this.name, attrs)
      },
      unsetGitHubReference: () => ({ commands }: { commands: { unsetMark: (name: string) => boolean } }) => {
        return commands.unsetMark(this.name)
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: githubRefPluginKey,
        props: {
          decorations(state: EditorState) {
            const decorations: Decoration[] = []
            state.doc.descendants((node: ProseMirrorNode, pos: number) => {
              if (!node.isText || !node.text) return

              const regex = createGitHubReferenceRegex('gi')
              let match

              while ((match = regex.exec(node.text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length

                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'github-ref',
                  }),
                )
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
