import type { Achievement } from '~~/shared/types/profile'

export function parseAchievements(html: string, login: string): Achievement[] {
  const achievements: Achievement[] = []
  const seen = new Set<string>()

  // Match achievement links: <a href="/user?achievement=slug&tab=achievements">
  //   <img src="..." alt="Achievement: Name" />
  //   optional tier text like "x2"
  // </a>
  const linkPattern = new RegExp(
    `<a[^>]*href="/${escapeRegExp(login)}\\?achievement=([^&"]+)&amp;tab=achievements"[^>]*>([\\s\\S]*?)</a>`,
    'gi',
  )

  let match = linkPattern.exec(html)
  while (match) {
    const slug = match[1]!
    const inner = match[2]!

    const altMatch = /alt="Achievement:\s*([^"]+)"/.exec(inner)
    const name = altMatch?.[1]?.trim() ?? slugToName(slug)

    const imgMatch = /src="([^"]+)"/.exec(inner)
    const imageUrl = imgMatch?.[1] ?? ''

    // Match standalone "x2", "x3" etc. — not inside words or CSS values
    const plainText = inner.replace(/<[^>]*>/g, '').trim()
    const tierMatch = /\bx(\d+)\b/.exec(plainText)
    const tier = tierMatch ? Number(tierMatch[1]) : 1

    if (slug && imageUrl && !seen.has(slug)) {
      seen.add(slug)
      achievements.push({ name, slug, tier, imageUrl })
    }

    match = linkPattern.exec(html)
  }

  return achievements
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
