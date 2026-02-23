import type { GitHubContributor, GitHubContent, GitHubIssue, GitHubNotification, GitHubPullRequest, GitHubRelease, GitHubRepo, GitHubRepoDetail, RepoContributor, RepoDetail, RepoFileContent, RepoIssue, RepoNotification, RepoPullRequest, RepoRelease, Repository, RepoTreeEntry } from '../types/repository'

/**
 * Helper function to map a GitHub response to camelCase format
 * @param r GitHub Repository response
 * @returns Our Repository format
 */
export function toRepository(r: GitHubRepo): Repository {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    language: r.language,
    visibility: r.visibility,
    defaultBranch: r.default_branch,
    topics: r.topics,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url },
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    openIssuesCount: r.open_issues_count,
    watchersCount: r.watchers_count,
    fork: r.fork,
    archived: r.archived,
    isTemplate: r.is_template,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
  }
}

export function toRepoIssue(i: GitHubIssue): RepoIssue {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    state: i.state,
    htmlUrl: i.html_url,
    comments: i.comments,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    user: { login: i.user.login, avatarUrl: i.user.avatar_url },
    labels: i.labels,
    assignees: i.assignees.map(a => ({ login: a.login, avatarUrl: a.avatar_url })),
    milestone: i.milestone?.title ?? null,
  }
}

export function toRepoPullRequest(pr: GitHubPullRequest): RepoPullRequest {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft,
    htmlUrl: pr.html_url,
    comments: pr.comments,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    user: { login: pr.user.login, avatarUrl: pr.user.avatar_url },
    labels: pr.labels,
    assignees: pr.assignees.map(a => ({ login: a.login, avatarUrl: a.avatar_url })),
    requestedReviewers: pr.requested_reviewers.map(r => ({ login: r.login, avatarUrl: r.avatar_url })),
    milestone: pr.milestone?.title ?? null,
    headRef: pr.head.ref,
  }
}

export function toRepoNotification(n: GitHubNotification): RepoNotification {
  return {
    id: n.id,
    reason: n.reason,
    updatedAt: n.updated_at,
    title: n.subject.title,
    type: n.subject.type,
    subjectUrl: n.subject.url,
  }
}

export function toRepoDetail(r: GitHubRepoDetail): RepoDetail {
  return {
    ...toRepository(r),
    license: r.license ? { key: r.license.key, name: r.license.name, spdxId: r.license.spdx_id } : null,
    subscribersCount: r.subscribers_count,
    networkCount: r.network_count,
    hasWiki: r.has_wiki,
    hasPages: r.has_pages,
    parent: r.parent ? { fullName: r.parent.full_name, htmlUrl: r.parent.html_url } : undefined,
  }
}

export function toRepoTreeEntry(c: GitHubContent): RepoTreeEntry {
  return {
    name: c.name,
    path: c.path,
    type: c.type === 'dir' ? 'dir' : 'file',
    size: c.size,
  }
}

function decodeBase64Utf8(base64: string): string {
  const normalized = base64.replace(/\n/g, '')

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64').toString('utf-8')
  }

  if (typeof atob !== 'undefined') {
    const binary = atob(normalized)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }

  return normalized
}

export function toRepoFileContent(c: GitHubContent): RepoFileContent {
  const raw = c.content ?? ''
  const decoded = c.encoding === 'base64'
    ? decodeBase64Utf8(raw)
    : raw
  return {
    name: c.name,
    path: c.path,
    content: decoded,
    size: c.size,
  }
}

export function toRepoRelease(r: GitHubRelease): RepoRelease {
  return {
    tagName: r.tag_name,
    name: r.name ?? r.tag_name,
    publishedAt: r.published_at,
    htmlUrl: r.html_url,
  }
}

export function toRepoContributor(c: GitHubContributor): RepoContributor {
  return {
    login: c.login,
    avatarUrl: c.avatar_url,
    contributions: c.contributions,
  }
}
