import { describe, expect, it } from 'vitest'
import { toRepository, toRepoIssue, toRepoPullRequest, toRepoNotification, toRepoDetail, toRepoTreeEntry, toRepoFileContent, toRepoRelease, toRepoContributor } from '../../shared/utils/repository'
import type { GitHubRepo, GitHubIssue, GitHubPullRequest, GitHubNotification, Repository, GitHubRepoDetail, GitHubContent, GitHubRelease, GitHubContributor } from '../../shared/types/repository'

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

describe('repo detail mappers', () => {
  const ghRepoDetail: GitHubRepoDetail = {
    ...ghRepo,
    subscribers_count: 77,
    network_count: 12,
    has_wiki: true,
    has_pages: false,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    parent: {
      ...ghRepo,
      full_name: 'upstream/flumen',
      html_url: 'https://github.com/upstream/flumen',
    },
  }

  it('toRepoDetail maps repo detail fields and parent metadata', () => {
    const result = toRepoDetail(ghRepoDetail)
    expect(result.subscribersCount).toBe(77)
    expect(result.networkCount).toBe(12)
    expect(result.hasWiki).toBe(true)
    expect(result.hasPages).toBe(false)
    expect(result.license?.spdxId).toBe('MIT')
    expect(result.parent?.fullName).toBe('upstream/flumen')
  })

  it('toRepoTreeEntry maps dir and file types correctly', () => {
    const dir: GitHubContent = {
      name: 'src',
      path: 'src',
      type: 'dir',
      size: 0,
      html_url: 'https://github.com/org/repo/tree/main/src',
    }

    const file: GitHubContent = {
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      size: 128,
      html_url: 'https://github.com/org/repo/blob/main/README.md',
    }

    expect(toRepoTreeEntry(dir).type).toBe('dir')
    expect(toRepoTreeEntry(file).type).toBe('file')
  })

  it('toRepoFileContent decodes base64 content', () => {
    const content: GitHubContent = {
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      size: 5,
      encoding: 'base64',
      content: 'aGVsbG8=',
      html_url: 'https://github.com/org/repo/blob/main/README.md',
    }

    expect(toRepoFileContent(content).content).toBe('hello')
  })

  it('toRepoRelease maps release fields', () => {
    const release: GitHubRelease = {
      tag_name: 'v1.2.3',
      name: null,
      published_at: '2025-06-01T00:00:00Z',
      html_url: 'https://github.com/org/repo/releases/tag/v1.2.3',
    }

    const result = toRepoRelease(release)
    expect(result.tagName).toBe('v1.2.3')
    expect(result.name).toBe('v1.2.3')
  })

  it('toRepoContributor maps contributor avatar and contributions', () => {
    const contributor: GitHubContributor = {
      login: 'alice',
      avatar_url: 'https://a.com/alice.png',
      contributions: 42,
    }

    const result = toRepoContributor(contributor)
    expect(result.login).toBe('alice')
    expect(result.avatarUrl).toBe('https://a.com/alice.png')
    expect(result.contributions).toBe(42)
  })
})
