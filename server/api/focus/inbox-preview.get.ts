const BODY_LIMIT = 500

/**
 * Lightweight preview endpoint for inbox items.
 * Fetches raw markdown body, last commit message (PR), milestone and linked PRs (Issue).
 * Meant to be called on explicit user click, not on hover.
 */
export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)

  const query = getQuery(event)
  const repo = (query.repo as string) || ''
  const number = Number(query.number) || 0
  const type = (query.type as string) === 'issue' ? 'issue' : 'pr'

  if (!repo || !number) {
    throw createError({ statusCode: 400, statusMessage: 'Missing repo or number' })
  }

  const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
  if (!REPO_RE.test(repo)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid repo format' })
  }

  const [owner, name] = repo.split('/')

  if (type === 'pr') {
    const gql = /* GraphQL */ `
      query PRPreview($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            body
            commits(last: 1) {
              nodes {
                commit { message }
              }
            }
          }
        }
      }
    `

    const data = await githubGraphQL<{
      repository: {
        pullRequest: {
          body: string
          commits: { nodes: Array<{ commit: { message: string } }> }
        } | null
      }
    }>(token, gql, { owner, name, number })

    const pr = data.repository.pullRequest
    if (!pr) {
      throw createError({ statusCode: 404, statusMessage: 'PR not found' })
    }

    const raw = pr.body || ''
    return {
      type: 'pr' as const,
      body: raw.length > BODY_LIMIT ? `${raw.slice(0, BODY_LIMIT)}…` : raw || null,
      lastCommitMessage: pr.commits.nodes[0]?.commit.message || null,
    }
  }

  // Issue
  const gql = /* GraphQL */ `
    query IssuePreview($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          body
          milestone { title }
          timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 5) {
            nodes {
              ... on CrossReferencedEvent {
                source {
                  ... on PullRequest {
                    number
                    title
                    state
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  `

  const data = await githubGraphQL<{
    repository: {
      issue: {
        body: string
        milestone: { title: string } | null
        timelineItems: {
          nodes: Array<{
            source?: {
              number?: number
              title?: string
              state?: string
              url?: string
            }
          }>
        }
      } | null
    }
  }>(token, gql, { owner, name, number })

  const issue = data.repository.issue
  if (!issue) {
    throw createError({ statusCode: 404, statusMessage: 'Issue not found' })
  }

  const linkedPRs = issue.timelineItems.nodes
    .filter(n => n.source?.number)
    .map(n => ({
      number: n.source!.number!,
      title: n.source!.title!,
      state: n.source!.state!,
      url: n.source!.url!,
    }))

  const raw = issue.body || ''
  return {
    type: 'issue' as const,
    body: raw.length > BODY_LIMIT ? `${raw.slice(0, BODY_LIMIT)}…` : raw || null,
    milestone: issue.milestone?.title || null,
    linkedPRs: linkedPRs.length > 0 ? linkedPRs : null,
  }
})
