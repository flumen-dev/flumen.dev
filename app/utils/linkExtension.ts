import { createGitHubReferenceRegex } from '~/utils/githubReferences'

/**
 * Pre-process markdown: convert plain @mentions to GitHub profile links.
 * Already-linked mentions like [@user](url) are left untouched.
 */
export function linkifyMentions(md: string): string {
  return md.replace(/(?<!\[)@([a-zA-Z\d](?:[a-zA-Z\d-]*[a-zA-Z\d])?)(?=[^.\w/]|$)/gm, '[@$1](https://github.com/$1)')
}

const GITHUB_USER_URL = /^https?:\/\/github\.com\/([a-zA-Z\d](?:[a-zA-Z\d-]*[a-zA-Z\d])?)$/

/**
 * Post-render DOM enhancement: convert @mention links into interactive chips
 * with avatar, username, copy and open buttons.
 */
export function enhanceMentionChips(dom: HTMLElement) {
  dom.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || ''

    const match = href.match(GITHUB_USER_URL)
    const text = a.textContent?.trim() || ''
    if (!match || text !== `@${match[1]}`) return
    if (a.dataset.mention) return // already processed

    const login = match[1]!

    a.dataset.mention = login
    a.classList.add('mention-chip')
    a.removeAttribute('target')

    a.innerHTML = ''

    const img = document.createElement('img')
    img.src = `https://github.com/${login}.png?size=40`
    img.alt = login
    img.className = 'mention-avatar'
    img.loading = 'lazy'

    const name = document.createElement('span')
    name.className = 'mention-login'
    name.textContent = `@${login}`

    const actions = document.createElement('span')
    actions.className = 'mention-actions'

    const copyBtn = document.createElement('button')
    copyBtn.className = 'mention-btn'
    copyBtn.title = 'Copy link'
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      navigator.clipboard.writeText(href)
    })

    const openBtn = document.createElement('a')
    openBtn.className = 'mention-btn'
    openBtn.href = href
    openBtn.target = '_blank'
    openBtn.rel = 'noopener noreferrer'
    openBtn.title = 'View on GitHub'
    openBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation()
    })

    actions.append(copyBtn, openBtn)
    a.append(img, name, actions)

    a.addEventListener('click', (e) => {
      e.preventDefault()
    })
  })
}

/**
 * Post-render DOM enhancement: convert `close(s) #123` / `fix(es) #123` / `resolve(s) #123`
 * plain text references into GitHub issue links with chip styling.
 */
export function enhanceGitHubReferences(dom: HTMLElement, repoContext?: string) {
  if (!repoContext) return

  const regex = createGitHubReferenceRegex('gi')
  const textNodes: Text[] = []

  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const textNode = node as Text
      const parent = textNode.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('a, code, pre')) return NodeFilter.FILTER_REJECT
      regex.lastIndex = 0
      return regex.test(textNode.nodeValue || '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  let current: Node | null
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text)
  }

  for (const node of textNodes) {
    const text = node.nodeValue || ''
    regex.lastIndex = 0

    const fragment = document.createDocumentFragment()
    let last = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const keyword = match[1] || ''
      const issue = match[2] || ''

      if (start > last) {
        fragment.append(document.createTextNode(text.slice(last, start)))
      }

      const link = document.createElement('a')
      link.href = `https://github.com/${repoContext}/issues/${issue}`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.className = 'github-ref'
      link.textContent = `${keyword} #${issue}`
      fragment.append(link)

      last = end
    }

    if (last < text.length) {
      fragment.append(document.createTextNode(text.slice(last)))
    }

    node.replaceWith(fragment)
  }
}
