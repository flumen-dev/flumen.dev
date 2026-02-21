import { describe, expect, it } from 'vitest'
import { mapCiStatus, mapCreatedNode } from '../../server/utils/focus-created'
import type { GQLCreatedNode } from '../../server/utils/focus-created'

// --- Helpers ---

const zeroReactions = {
  reactions: { totalCount: 0 },
  thumbsUp: { totalCount: 0 },
  thumbsDown: { totalCount: 0 },
  laugh: { totalCount: 0 },
  hooray: { totalCount: 0 },
  heart: { totalCount: 0 },
  rocket: { totalCount: 0 },
  eyes: { totalCount: 0 },
  confused: { totalCount: 0 },
}

function makeNode(overrides: Partial<GQLCreatedNode> = {}): GQLCreatedNode {
  return {
    id: 'I_1',
    number: 42,
    title: 'Test issue',
    state: 'OPEN',
    stateReason: null,
    url: 'https://github.com/org/repo/issues/42',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
    labels: { nodes: [] },
    assignees: { nodes: [] },
    comments: { totalCount: 0, nodes: [] },
    ...zeroReactions,
    timelineItems: { nodes: [] },
    repository: { nameWithOwner: 'org/repo' },
    ...overrides,
  }
}

// --- mapCiStatus ---

describe('mapCiStatus', () => {
  it('maps SUCCESS', () => {
    expect(mapCiStatus('SUCCESS')).toBe('SUCCESS')
  })

  it('maps FAILURE', () => {
    expect(mapCiStatus('FAILURE')).toBe('FAILURE')
  })

  it('maps ERROR to FAILURE', () => {
    expect(mapCiStatus('ERROR')).toBe('FAILURE')
  })

  it('maps PENDING', () => {
    expect(mapCiStatus('PENDING')).toBe('PENDING')
  })

  it('maps EXPECTED to PENDING', () => {
    expect(mapCiStatus('EXPECTED')).toBe('PENDING')
  })

  it('returns null for unknown values', () => {
    expect(mapCiStatus('UNKNOWN')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(mapCiStatus(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(mapCiStatus(null)).toBeNull()
  })
})

// --- mapCreatedNode: needsResponse ---

describe('mapCreatedNode — needsResponse', () => {
  it('is false when there are no comments', () => {
    const result = mapCreatedNode(makeNode(), 'me')
    expect(result.needsResponse).toBe(false)
  })

  it('is false when the last comment is from the current user', () => {
    const node = makeNode({
      comments: {
        totalCount: 3,
        nodes: [{ author: { login: 'me' }, createdAt: '2025-01-10T00:00:00Z' }],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.needsResponse).toBe(false)
  })

  it('is true when the last comment is from someone else', () => {
    const node = makeNode({
      comments: {
        totalCount: 2,
        nodes: [{ author: { login: 'contributor' }, createdAt: '2025-01-10T00:00:00Z' }],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.needsResponse).toBe(true)
    expect(result.lastCommentAuthor).toBe('contributor')
  })

  it('is true when the last comment has null author (deleted user)', () => {
    const node = makeNode({
      comments: {
        totalCount: 1,
        nodes: [{ author: null, createdAt: '2025-01-10T00:00:00Z' }],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.needsResponse).toBe(true)
    expect(result.lastCommentAuthor).toBeNull()
  })
})

// --- mapCreatedNode: linked PRs ---

describe('mapCreatedNode — linked PRs', () => {
  it('extracts PRs from timeline cross-references', () => {
    const node = makeNode({
      timelineItems: {
        nodes: [{
          source: {
            number: 99,
            title: 'Fix it',
            state: 'OPEN',
            isDraft: false,
            url: 'https://github.com/org/repo/pull/99',
            author: { login: 'dev', avatarUrl: 'https://avatar' },
            reviewDecision: 'APPROVED',
            commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
          },
        }],
      },
    })

    const result = mapCreatedNode(node, 'me')
    expect(result.linkedPrs).toHaveLength(1)
    expect(result.linkedPrs[0]).toEqual({
      number: 99,
      title: 'Fix it',
      state: 'OPEN',
      isDraft: false,
      url: 'https://github.com/org/repo/pull/99',
      author: { login: 'dev', avatarUrl: 'https://avatar' },
      reviewDecision: 'APPROVED',
      ciStatus: 'SUCCESS',
    })
  })

  it('skips timeline events with null source', () => {
    const node = makeNode({
      timelineItems: {
        nodes: [
          { source: null },
          { source: { number: 10, title: 'PR', state: 'OPEN', url: 'u' } },
        ],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.linkedPrs).toHaveLength(1)
    expect(result.linkedPrs[0]!.number).toBe(10)
  })

  it('uses ghost author when PR author is missing', () => {
    const node = makeNode({
      timelineItems: {
        nodes: [{
          source: { number: 5, title: 'PR', state: 'MERGED', url: 'u' },
        }],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.linkedPrs[0]!.author).toEqual({ login: 'ghost', avatarUrl: '' })
  })

  it('maps CI status through to linked PR', () => {
    const node = makeNode({
      timelineItems: {
        nodes: [{
          source: {
            number: 7,
            title: 'PR',
            state: 'OPEN',
            url: 'u',
            commits: { nodes: [{ commit: { statusCheckRollup: { state: 'ERROR' } } }] },
          },
        }],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.linkedPrs[0]!.ciStatus).toBe('FAILURE')
  })

  it('handles PR with no commits/statusCheckRollup', () => {
    const node = makeNode({
      timelineItems: {
        nodes: [{
          source: { number: 3, title: 'PR', state: 'OPEN', url: 'u' },
        }],
      },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.linkedPrs[0]!.ciStatus).toBeNull()
  })
})

// --- mapCreatedNode: reactions ---

describe('mapCreatedNode — reactions', () => {
  it('maps all reaction types correctly', () => {
    const node = makeNode({
      reactions: { totalCount: 15 },
      thumbsUp: { totalCount: 5 },
      thumbsDown: { totalCount: 1 },
      laugh: { totalCount: 2 },
      hooray: { totalCount: 1 },
      heart: { totalCount: 3 },
      rocket: { totalCount: 1 },
      eyes: { totalCount: 1 },
      confused: { totalCount: 1 },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.reactions.totalCount).toBe(15)
    expect(result.reactions.thumbsUp).toBe(5)
    expect(result.reactions.heart).toBe(3)
  })
})

// --- mapCreatedNode: basic fields ---

describe('mapCreatedNode — basic fields', () => {
  it('maps repo from repository.nameWithOwner', () => {
    const result = mapCreatedNode(makeNode(), 'me')
    expect(result.repo).toBe('org/repo')
  })

  it('flattens labels and assignees from nested nodes', () => {
    const node = makeNode({
      labels: { nodes: [{ name: 'bug', color: 'ff0000' }] },
      assignees: { nodes: [{ login: 'dev', avatarUrl: 'https://a' }] },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.labels).toEqual([{ name: 'bug', color: 'ff0000' }])
    expect(result.assignees).toEqual([{ login: 'dev', avatarUrl: 'https://a' }])
  })

  it('uses commentCount from comments.totalCount', () => {
    const node = makeNode({
      comments: { totalCount: 7, nodes: [] },
    })
    const result = mapCreatedNode(node, 'me')
    expect(result.commentCount).toBe(7)
  })
})
