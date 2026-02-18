import { Mark, markPasteRule, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode, MarkType } from '@tiptap/pm/model'

/**
 * TipTap mark extension that detects standalone commit SHA hashes
 * (7-40 hex characters) and renders them as monospace short links.
 *
 * Only matches SHAs that appear as standalone words (not inside longer words
 * or URLs). Decorates them visually via a ProseMirror plugin.
 */

const COMMIT_SHA_PASTE_REGEX = /\b([0-9a-f]{7,40})\b/gi

interface CommitShaLinkOptions {
  /** Base URL prefix for commit links. Provide repo URL to enable linking. */
  commitUrlPrefix: string
  /** HTML attributes to add to the rendered element */
  HTMLAttributes: Record<string, unknown>
}

const commitShaPluginKey = new PluginKey('commitShaDecoration')

export const CommitShaLink = Mark.create<CommitShaLinkOptions>({
  name: 'commitShaLink',

  addOptions() {
    return {
      commitUrlPrefix: '',
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      sha: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-commit-sha'),
        renderHTML: (attributes: Record<string, string>) => {
          if (!attributes.sha) return {}
          return { 'data-commit-sha': attributes.sha }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'code[data-commit-sha]' },
    ]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['code', mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
      {
        class: 'commit-sha',
      },
    ), 0]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: COMMIT_SHA_PASTE_REGEX,
        type: this.type,
        getAttributes: (match: RegExpMatchArray) => {
          return { sha: match[1] }
        },
      }),
    ]
  },

  addProseMirrorPlugins() {
    const markType = this.type
    return [
      new Plugin({
        key: commitShaPluginKey,
        props: {
          decorations(state: EditorState) {
            const decorations: Decoration[] = []
            state.doc.descendants((node: ProseMirrorNode, pos: number) => {
              if (!node.isText || !node.text) return

              const regex = /\b([0-9a-f]{7,40})\b/gi
              let match

              while ((match = regex.exec(node.text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length

                // Check if already has the mark
                const hasMark = state.doc.resolve(from + 1).marks().some((m: { type: MarkType }) => m.type === markType)
                if (!hasMark) {
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'commit-sha-decoration',
                    }),
                  )
                }
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
