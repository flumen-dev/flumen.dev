import type { GitHubIssue, GitHubRepo, RepoIssue, Repository } from '../types/repository'

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
  }
}
