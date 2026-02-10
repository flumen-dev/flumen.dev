import type { GitHubIssue, GitHubNotification, GitHubPullRequest, GitHubRepo, RepoIssue, RepoNotification, RepoPullRequest, Repository } from '../types/repository'

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
