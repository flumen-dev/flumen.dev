import { describe, expect, it } from 'vitest'
import { mapEvent, type GitHubEvent } from '../../server/utils/activity'

function event(overrides: Partial<GitHubEvent> & { type: string }): GitHubEvent {
  return {
    repo: { name: 'owner/repo' },
    created_at: '2025-06-01T12:00:00Z',
    payload: {},
    ...overrides,
  }
}

describe('mapEvent', () => {
  it('maps PushEvent', () => {
    const result = mapEvent(event({ type: 'PushEvent', payload: { ref: 'refs/heads/main' } }))
    expect(result).toEqual({
      type: 'push',
      repo: 'owner/repo',
      createdAt: '2025-06-01T12:00:00Z',
      ref: 'main',
    })
  })

  it('strips refs/heads/ prefix from push ref', () => {
    const result = mapEvent(event({ type: 'PushEvent', payload: { ref: 'refs/heads/feat/new' } }))
    expect(result?.ref).toBe('feat/new')
  })

  it('maps IssuesEvent', () => {
    const result = mapEvent(event({
      type: 'IssuesEvent',
      payload: { action: 'opened', issue: { title: 'Bug report', number: 42 } },
    }))
    expect(result).toMatchObject({ type: 'issue', action: 'opened', title: 'Bug report', number: 42 })
  })

  it('maps PullRequestEvent', () => {
    const result = mapEvent(event({
      type: 'PullRequestEvent',
      payload: { action: 'closed', pull_request: { title: 'Fix bug', number: 7 } },
    }))
    expect(result).toMatchObject({ type: 'pr', action: 'closed', title: 'Fix bug', number: 7 })
  })

  it('maps CreateEvent', () => {
    const result = mapEvent(event({
      type: 'CreateEvent',
      payload: { ref_type: 'branch', ref: 'feat/new' },
    }))
    expect(result).toMatchObject({ type: 'create', refType: 'branch', ref: 'feat/new' })
  })

  it('maps ReleaseEvent', () => {
    const result = mapEvent(event({
      type: 'ReleaseEvent',
      payload: { action: 'published', release: { tag_name: 'v1.0.0' } },
    }))
    expect(result).toMatchObject({ type: 'release', action: 'published', tagName: 'v1.0.0' })
  })

  it('maps WatchEvent to star', () => {
    const result = mapEvent(event({ type: 'WatchEvent' }))
    expect(result).toMatchObject({ type: 'star', repo: 'owner/repo' })
  })

  it('maps ForkEvent', () => {
    const result = mapEvent(event({ type: 'ForkEvent' }))
    expect(result).toMatchObject({ type: 'fork', repo: 'owner/repo' })
  })

  it('returns null for unknown event types', () => {
    expect(mapEvent(event({ type: 'GollumEvent' }))).toBeNull()
    expect(mapEvent(event({ type: 'DeleteEvent' }))).toBeNull()
  })

  it('preserves repo and createdAt in all mapped events', () => {
    const types = ['PushEvent', 'IssuesEvent', 'PullRequestEvent', 'CreateEvent', 'ReleaseEvent', 'WatchEvent', 'ForkEvent']
    for (const type of types) {
      const result = mapEvent(event({ type }))
      expect(result?.repo).toBe('owner/repo')
      expect(result?.createdAt).toBe('2025-06-01T12:00:00Z')
    }
  })
})
