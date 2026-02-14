import { Extension } from '@tiptap/core'

/**
 * Pre-process markdown: convert plain @mentions to GitHub profile links.
 * Already-linked mentions like [@user](url) are left untouched.
 */
export function linkifyMentions(md: string): string {
  return md.replace(/(?<!\[)@([a-zA-Z\d](?:[a-zA-Z\d-]*[a-zA-Z\d])?)(?=[^.\w/]|$)/gm, '[@$1](https://github.com/$1)')
}

const GITHUB_USER_URL = /^https?:\/\/github\.com\/([a-zA-Z\d](?:[a-zA-Z\d-]*[a-zA-Z\d])?)$/

/**
 * TipTap extension: enhance rendered links (target="_blank", reproduction class, mention chips).
 */
export const LinkEnhancer = Extension.create({
  name: 'linkEnhancer',

  onCreate() {
    requestAnimationFrame(() => enhanceLinks(this.editor.view.dom))
  },

  onUpdate() {
    requestAnimationFrame(() => enhanceLinks(this.editor.view.dom))
  },
})

function enhanceLinks(dom: HTMLElement) {
  dom.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || ''

    if (/^https?:\/\//.test(href)) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }

    if (/stackblitz\.com|codesandbox\.io|codepen\.io|replay\.io|github\.com\/.*\/reproductions?\//i.test(href)) {
      a.classList.add('reproduction-link')
    }

    // Mention chip: @user → avatar + name + copy/open buttons
    const match = href.match(GITHUB_USER_URL)
    const text = a.textContent?.trim() || ''
    if (match && text === `@${match[1]}`) {
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

      // Prevent default link navigation on chip click
      a.addEventListener('click', (e) => {
        e.preventDefault()
      })
    }
  })
}
