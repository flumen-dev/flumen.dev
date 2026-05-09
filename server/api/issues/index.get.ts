import type { Issue } from '~~/shared/types/issue'
import type { PaginatedResponse } from '~~/shared/types/pagination'

export default defineEventHandler(async (event): Promise<PaginatedResponse<Issue>> => {
  const { token, login } = await getSessionToken(event)
  const { state = 'open', repo, first = '20', after, assignedToMe, unassigned, label, milestone, author, assignee } = getQuery<{
    state?: string
    repo?: string
    first?: string
    after?: string
    assignedToMe?: string
    unassigned?: string
    label?: string
    milestone?: string
    author?: string
    assignee?: string
  }>(event)

  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid repo query parameter' })
  }

  const isAssignedToMe = assignedToMe === '1' || assignedToMe === 'true'
  const isUnassigned = unassigned === '1' || unassigned === 'true'

  if (isAssignedToMe && isUnassigned) {
    throw createError({ statusCode: 400, message: 'assignedToMe and unassigned are mutually exclusive' })
  }

  const pageSize = Math.min(Math.max(Number(first) || 20, 1), 100)
  const stateQ = state === 'closed' ? 'is:closed' : 'is:open'
  let query = `is:issue ${stateQ} repo:${repo} sort:updated-desc`
  if (isAssignedToMe) query += ` assignee:${login}`
  if (isUnassigned) query += ` no:assignee`

  function escapeGitHubQuery(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  }

  if (milestone === '*') {
    query += ` milestone:*`
  }
  else if (milestone) {
    query += ` milestone:"${escapeGitHubQuery(String(milestone))}"`
  }
  if (label) {
    for (const l of String(label).split(',')) {
      if (l.trim()) query += ` label:"${escapeGitHubQuery(l.trim())}"`
    }
  }
  // GitHub login regex: alphanumeric + hyphens (no leading/trailing/double hyphen).
  const LOGIN_RE = /^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/
  if (author && LOGIN_RE.test(String(author))) query += ` author:${author}`
  if (assignee && LOGIN_RE.test(String(assignee))) query += ` assignee:${assignee}`

  const page = await searchIssues(token, query, { first: pageSize, after })
  const items = await getOrFetchIssues(token, login, page.minimalNodes)

  return {
    items,
    totalCount: page.totalCount,
    pageInfo: page.pageInfo,
  }
})
