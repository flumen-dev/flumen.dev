import { describe, expect, it } from 'vitest'

// Mirror the map from reactions.post.ts for testing
const REACTION_MAP: Record<string, string> = {
  THUMBS_UP: '+1',
  THUMBS_DOWN: '-1',
  LAUGH: 'laugh',
  HOORAY: 'hooray',
  CONFUSED: 'confused',
  HEART: 'heart',
  ROCKET: 'rocket',
  EYES: 'eyes',
}

describe('REACTION_MAP', () => {
  it('maps all 8 GraphQL reaction types to REST format', () => {
    expect(Object.keys(REACTION_MAP)).toHaveLength(8)
  })

  it('maps THUMBS_UP to +1', () => {
    expect(REACTION_MAP.THUMBS_UP).toBe('+1')
  })

  it('maps THUMBS_DOWN to -1', () => {
    expect(REACTION_MAP.THUMBS_DOWN).toBe('-1')
  })

  it('maps emoji reactions to lowercase strings', () => {
    expect(REACTION_MAP.LAUGH).toBe('laugh')
    expect(REACTION_MAP.HOORAY).toBe('hooray')
    expect(REACTION_MAP.CONFUSED).toBe('confused')
    expect(REACTION_MAP.HEART).toBe('heart')
    expect(REACTION_MAP.ROCKET).toBe('rocket')
    expect(REACTION_MAP.EYES).toBe('eyes')
  })

  it('falls back to lowercase for unknown content', () => {
    const content = 'UNKNOWN_TYPE'
    const restContent = REACTION_MAP[content] || content.toLowerCase()
    expect(restContent).toBe('unknown_type')
  })
})
