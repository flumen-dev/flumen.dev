import { describe, expect, it } from 'vitest'
import { toRepository, toRepoIssue, toRepoPullRequest, toRepoNotification } from '../../shared/utils/repository'
import type { GitHubRepo, GitHubIssue, GitHubPullRequest, GitHubNotification, Repository } from '../../shared/types/repository'

const ghRepo: GitHubRepo = {
  id: 1,
  name: 'flumen',
  full_name: 'flumen-dev/flumen',
  description: 'Dashboard',
  html_url: 'https://github.com/flumen-dev/flumen',
  language: 'TypeScript',
  visibility: 'public',
  default_branch: 'main',
  topics: ['nuxt', 'vue'],
  owner: { login: 'flumen-dev', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  stargazers_count: 42,
  forks_count: 5,
  open_issues_count: 3,
  watchers_count: 10,
  fork: false,
  archived: false,
  is_template: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
  pushed_at: '2025-06-15T12:00:00Z',
}

describe('toRepository', () => {
  it('maps all fields and renames snake_case to camelCase', () => {
    const result = toRepository(ghRepo)

    expect(result.fullName).toBe('flumen-dev/flumen')
    expect(result.htmlUrl).toBe('https://github.com/flumen-dev/flumen')
    expect(result.defaultBranch).toBe('main')
    expect(result.owner.avatarUrl).toBe('https://avatars.githubusercontent.com/u/1')
    expect(result.stargazersCount).toBe(42)
    expect(result.isTemplate).toBe(false)
    expect(result.pushedAt).toBe('2025-06-15T12:00:00Z')
  })

  it('output has exactly the keys defined in Repository interface', () => {
    const result = toRepository(ghRepo)
    const expectedKeys: (keyof Repository)[] = [
      'id', 'name', 'fullName', 'description', 'htmlUrl', 'language',
      'visibility', 'defaultBranch', 'topics', 'owner', 'stargazersCount',
      'forksCount', 'openIssuesCount', 'watchersCount', 'fork', 'archived',
      'isTemplate', 'createdAt', 'updatedAt', 'pushedAt',
    ]
    expect(Object.keys(result).sort()).toEqual([...expectedKeys].sort())
  })

  it('handles null pushedAt (new empty repo)', () => {
    const result = toRepository({ ...ghRepo, pushed_at: null })
    expect(result.pushedAt).toBeNull()
  })
})

describe('toRepoIssue', () => {
  const ghIssue: GitHubIssue = {
    id: 10,
    number: 5,
    title: 'Bug report',
    state: 'open',
    html_url: 'https://github.com/org/repo/issues/5',
    comments: 2,
    created_at: '2025-03-01T00:00:00Z',
    updated_at: '2025-03-02T00:00:00Z',
    user: { login: 'alice', avatar_url: 'https://a.com/alice.png' },
    labels: [{ name: 'bug', color: 'ff0000' }],
    assignees: [
      { login: 'bob', avatar_url: 'https://a.com/bob.png' },
      { login: 'carol', avatar_url: 'https://a.com/carol.png' },
    ],
    milestone: { title: 'v1.0' },
  }

  it('maps nested user and assignees avatar_url to avatarUrl', () => {
    const result = toRepoIssue(ghIssue)
    expect(result.user.avatarUrl).toBe('https://a.com/alice.png')
    expect(result.assignees[0].avatarUrl).toBe('https://a.com/bob.png')
    expect(result.assignees).toHaveLength(2)
  })

  it('extracts milestone title, returns null when missing', () => {
    expect(toRepoIssue(ghIssue).milestone).toBe('v1.0')
    expect(toRepoIssue({ ...ghIssue, milestone: null }).milestone).toBeNull()
  })
})

describe('toRepoPullRequest', () => {
  const ghPr: GitHubPullRequest = {
    id: 20,
    number: 11,
    title: 'Add feature',
    state: 'open',
    draft: true,
    html_url: 'https://github.com/org/repo/pull/11',
    comments: 0,
    created_at: '2025-04-01T00:00:00Z',
    updated_at: '2025-04-02T00:00:00Z',
    user: { login: 'dave', avatar_url: 'https://a.com/dave.png' },
    labels: [],
    assignees: [],
    requested_reviewers: [
      { login: 'eve', avatar_url: 'https://a.com/eve.png' },
    ],
    milestone: null,
    head: { ref: 'feature/cool-stuff' },
  }

  it('maps head.ref to headRef and requested_reviewers to requestedReviewers', () => {
    const result = toRepoPullRequest(ghPr)
    expect(result.headRef).toBe('feature/cool-stuff')
    expect(result.requestedReviewers[0].avatarUrl).toBe('https://a.com/eve.png')
    expect(result.draft).toBe(true)
  })

  it('handles empty assignees and reviewers', () => {
    const result = toRepoPullRequest({ ...ghPr, assignees: [], requested_reviewers: [] })
    expect(result.assignees).toEqual([])
    expect(result.requestedReviewers).toEqual([])
  })
})

describe('toRepoNotification', () => {
  it('flattens subject into top-level fields', () => {
    const ghNotif: GitHubNotification = {
      id: '99',
      reason: 'mention',
      updated_at: '2025-05-01T00:00:00Z',
      repository: { full_name: 'org/repo' },
      subject: { title: 'PR merged', type: 'PullRequest', url: 'https://api.github.com/repos/org/repo/pulls/1' },
    }
    const result = toRepoNotification(ghNotif)
    expect(result.title).toBe('PR merged')
    expect(result.type).toBe('PullRequest')
    expect(result.subjectUrl).toBe('https://api.github.com/repos/org/repo/pulls/1')
    expect(result.updatedAt).toBe('2025-05-01T00:00:00Z')
  })

  it('handles null subject URL', () => {
    const ghNotif: GitHubNotification = {
      id: '100',
      reason: 'subscribed',
      updated_at: '2025-05-01T00:00:00Z',
      repository: { full_name: 'org/repo' },
      subject: { title: 'Discussion', type: 'Discussion', url: null },
    }
    expect(toRepoNotification(ghNotif).subjectUrl).toBeNull()
  })
})
