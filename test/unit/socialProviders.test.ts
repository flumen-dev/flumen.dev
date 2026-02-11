import { describe, expect, it } from 'vitest'
import { detectProvider, socialProviders } from '../../shared/socialProviders'

describe('detectProvider', () => {
  it('maps known URLs to the correct provider', () => {
    expect(detectProvider('https://youtube.com/@pewdiepie').id).toBe('youtube')
    expect(detectProvider('https://linkedin.com/in/john').id).toBe('linkedin')
    expect(detectProvider('https://bsky.app/profile/user.bsky.social').id).toBe('bluesky')
    expect(detectProvider('https://dev.to/flo').id).toBe('devto')
    expect(detectProvider('https://twitch.tv/ninja').id).toBe('twitch')
  })

  it('maps legacy twitter.com URLs to X provider', () => {
    expect(detectProvider('https://twitter.com/elonmusk').id).toBe('x')
    expect(detectProvider('https://x.com/elonmusk').id).toBe('x')
  })

  it('falls back to website for unknown URLs', () => {
    const result = detectProvider('https://my-random-site.org/profile')
    expect(result.id).toBe('website')
    expect(result.icon).toBe('i-lucide-globe')
  })

  it('every provider in urlPatterns resolves to an existing provider', () => {
    // Guards against adding a pattern with a typo in the provider id
    const ids = new Set(socialProviders.map(p => p.id))
    const patterns: [string, string][] = [
      ['youtube.com', 'youtube'],
      ['linkedin.com', 'linkedin'],
      ['instagram.com', 'instagram'],
      ['facebook.com', 'facebook'],
      ['bsky.app', 'bluesky'],
      ['x.com', 'x'],
      ['twitter.com', 'x'],
      ['mastodon.social', 'mastodon'],
      ['reddit.com', 'reddit'],
      ['dev.to', 'devto'],
      ['github.com', 'github'],
      ['twitch.tv', 'twitch'],
    ]
    for (const [domain, id] of patterns) {
      expect(ids.has(id), `Pattern "${domain}" → "${id}" has no matching provider`).toBe(true)
    }
  })
})
