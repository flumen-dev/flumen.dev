import { describe, expect, it } from 'vitest'
import { parseAchievements } from '../../server/utils/achievements'

// Realistic HTML snippet mimicking GitHub's achievements page structure.
// Achievements appear twice on the page: summary grid + detail cards.
function buildHtml(login: string) {
  return `
<div class="js-profile-editable-replace">
  <div class="d-flex flex-wrap gap-2">
    <a class="position-relative" href="/${login}?achievement=pull-shark&amp;tab=achievements">
      <img src="https://github.githubassets.com/assets/pull-shark-default-abc123.png" alt="Achievement: Pull Shark" class="achievement-badge" />
      x3
    </a>
    <a class="position-relative" href="/${login}?achievement=quickdraw&amp;tab=achievements">
      <img src="https://github.githubassets.com/assets/quickdraw-default-def456.png" alt="Achievement: Quickdraw" class="achievement-badge" />
    </a>
    <a class="position-relative" href="/${login}?achievement=yolo&amp;tab=achievements">
      <img src="https://github.githubassets.com/assets/yolo-default-ghi789.png" alt="Achievement: YOLO" class="achievement-badge" />
    </a>
  </div>
</div>
<!-- Detail section repeats the same achievements -->
<div class="js-achievement-card">
  <a href="/${login}?achievement=pull-shark&amp;tab=achievements">
    <img src="https://github.githubassets.com/assets/pull-shark-default-abc123.png" alt="Achievement: Pull Shark" />
    x3
  </a>
</div>
<div class="js-achievement-card">
  <a href="/${login}?achievement=quickdraw&amp;tab=achievements">
    <img src="https://github.githubassets.com/assets/quickdraw-default-def456.png" alt="Achievement: Quickdraw" />
  </a>
</div>
`
}

describe('parseAchievements', () => {
  const login = 'Flo0806'

  it('extracts achievements with name, slug, tier, and image URL', () => {
    const result = parseAchievements(buildHtml(login), login)

    expect(result).toHaveLength(3)

    expect(result[0]).toEqual({
      name: 'Pull Shark',
      slug: 'pull-shark',
      tier: 3,
      imageUrl: 'https://github.githubassets.com/assets/pull-shark-default-abc123.png',
    })

    expect(result[1]).toEqual({
      name: 'Quickdraw',
      slug: 'quickdraw',
      tier: 1,
      imageUrl: 'https://github.githubassets.com/assets/quickdraw-default-def456.png',
    })

    expect(result[2]).toEqual({
      name: 'YOLO',
      slug: 'yolo',
      tier: 1,
      imageUrl: 'https://github.githubassets.com/assets/yolo-default-ghi789.png',
    })
  })

  it('deduplicates achievements that appear multiple times in the HTML', () => {
    const result = parseAchievements(buildHtml(login), login)
    const slugs = result.map(a => a.slug)

    expect(slugs).toEqual([...new Set(slugs)])
    expect(slugs.filter(s => s === 'pull-shark')).toHaveLength(1)
  })

  it('returns empty array for HTML with no achievements', () => {
    const result = parseAchievements('<html><body>No badges here</body></html>', login)
    expect(result).toEqual([])
  })

  it('falls back to slug-derived name when alt text is missing', () => {
    const html = `
      <a href="/${login}?achievement=arctic-code-vault-contributor&amp;tab=achievements">
        <img src="https://github.githubassets.com/assets/arctic-abc.png" />
      </a>
    `
    const result = parseAchievements(html, login)

    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Arctic Code Vault Contributor')
  })

  it('does not match achievements from a different user in the same HTML', () => {
    const html = `
      <a href="/other-user?achievement=yolo&amp;tab=achievements">
        <img src="https://github.githubassets.com/assets/yolo-abc.png" alt="Achievement: YOLO" />
      </a>
    `
    const result = parseAchievements(html, login)
    expect(result).toEqual([])
  })

  it('escapes special regex characters in login', () => {
    const specialLogin = 'user.name+test'
    const html = `
      <a href="/${specialLogin}?achievement=starstruck&amp;tab=achievements">
        <img src="https://github.githubassets.com/assets/starstruck-abc.png" alt="Achievement: Starstruck" />
      </a>
    `
    const result = parseAchievements(html, specialLogin)
    expect(result).toHaveLength(1)
    expect(result[0]!.slug).toBe('starstruck')
  })

  it('skips entries without an image URL', () => {
    const html = `
      <a href="/${login}?achievement=ghost&amp;tab=achievements">
        <span>no image here</span>
      </a>
    `
    const result = parseAchievements(html, login)
    expect(result).toEqual([])
  })

  it('parses multi-digit tier values', () => {
    const html = `
      <a href="/${login}?achievement=pull-shark&amp;tab=achievements">
        <img src="https://github.githubassets.com/assets/pull-shark-abc.png" alt="Achievement: Pull Shark" />
        x16
      </a>
    `
    const result = parseAchievements(html, login)
    expect(result).toHaveLength(1)
    expect(result[0]!.tier).toBe(16)
  })
})
