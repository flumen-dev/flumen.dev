import DOMPurify from 'isomorphic-dompurify'
import { Marked } from 'marked'

const REPRO_RE = /stackblitz\.com|codesandbox\.io|codepen\.io|replay\.io|github\.com\/.*\/reproductions?\//i

const rendererExtension: import('marked').MarkedExtension = {
  renderer: {
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens!)
      const isExternal = /^https?:\/\//.test(href)
      const attrs = [
        `href="${href}"`,
        isExternal ? 'target="_blank" rel="noopener noreferrer"' : '',
        isExternal && REPRO_RE.test(href) ? 'class="reproduction-link"' : '',
      ].filter(Boolean).join(' ')
      return `<a ${attrs}>${inner}</a>`
    },

    list({ ordered, items }) {
      const tag = ordered ? 'ol' : 'ul'
      const hasTask = items.some(item => item.task)
      const cls = hasTask ? ' class="task-list"' : ''
      const body = items.map(item => this.listitem(item)).join('\n')
      return `<${tag}${cls}>\n${body}</${tag}>\n`
    },

    listitem({ tokens, task, checked }) {
      const inner = this.parser.parse(tokens!)
      if (!task) return `<li>${inner}</li>\n`
      const state = checked ? 'checked' : 'unchecked'
      const attr = checked ? ' checked' : ''
      // Remove the default checkbox that marked inserts, we add our own styled one
      const cleaned = inner.replace(/<input[^>]*type="checkbox"[^>]*>\s*/, '')
      return `<li data-task="${state}"><input type="checkbox" class="task-checkbox" disabled${attr}> ${cleaned}</li>\n`
    },
  },
}

const markedBreaks = new Marked({ gfm: true, breaks: true })
const markedNoBreaks = new Marked({ gfm: true, breaks: false })
markedBreaks.use(rendererExtension)
markedNoBreaks.use(rendererExtension)

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'a', 'img',
    'strong', 'em', 'del', 's', 'code', 'pre',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'input',
    'div', 'span', 'sup', 'sub',
    'details', 'summary',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'class', 'id',
    'type', 'checked', 'disabled',
    'data-task', 'data-mention',
    'loading',
    'align', 'colspan', 'rowspan',
  ],
}

export function renderMarkdown(source: string, breaks = true): string {
  const instance = breaks ? markedBreaks : markedNoBreaks
  const raw = instance.parse(source) as string
  return DOMPurify.sanitize(raw, PURIFY_CONFIG) as string
}
