import type {
  GraphQLIssueDetailResult,
  GraphQLIssueDetailNode,
  GraphQLTimelineNode,
  IssueDetail,
  TimelineItem,
  ReactionGroup,
} from '~~/shared/types/issue-detail'

const ISSUE_DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      number
      title
      body
      bodyHTML
      state
      stateReason
      url
      createdAt
      updatedAt
      closedAt
      locked
      authorAssociation
      author { login avatarUrl }
      labels(first: 20) { nodes { name color } }
      assignees(first: 10) { nodes { login avatarUrl } }
      milestone { title }
      reactionGroups { content viewerHasReacted reactors { totalCount } }
      timelineItems(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename
          ... on IssueComment {
            id
            body
            bodyHTML
            authorAssociation
            author { login avatarUrl }
            createdAt
            updatedAt
            reactionGroups { content viewerHasReacted reactors { totalCount } }
          }
          ... on LabeledEvent {
            createdAt
            actor { login }
            label { name color }
          }
          ... on UnlabeledEvent {
            createdAt
            actor { login }
            label { name color }
          }
          ... on AssignedEvent {
            createdAt
            actor { login }
            assignee { ... on User { login } }
          }
          ... on UnassignedEvent {
            createdAt
            actor { login }
            assignee { ... on User { login } }
          }
          ... on ClosedEvent {
            createdAt
            actor { login }
            stateReason
          }
          ... on ReopenedEvent {
            createdAt
            actor { login }
          }
          ... on CrossReferencedEvent {
            createdAt
            actor { login }
            source {
              ... on PullRequest { number title url state }
              ... on Issue { number title url state }
            }
          }
          ... on MilestonedEvent {
            createdAt
            actor { login }
            milestoneTitle
          }
          ... on RenamedTitleEvent {
            createdAt
            actor { login }
            previousTitle
            currentTitle
          }
          ... on ReferencedEvent {
            createdAt
            actor { login }
            commit { oid message }
          }
        }
      }
    }
  }
}
`

function toReactionGroups(groups: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>): ReactionGroup[] {
  return groups
    .filter(g => g.reactors.totalCount > 0 || g.viewerHasReacted)
    .map(g => ({ content: g.content, count: g.reactors.totalCount, viewerHasReacted: g.viewerHasReacted }))
}

function toTimelineItem(node: GraphQLTimelineNode): TimelineItem | null {
  switch (node.__typename) {
    case 'IssueComment':
      return {
        type: 'IssueComment',
        id: node.id,
        body: node.body,
        bodyHTML: node.bodyHTML,
        authorAssociation: node.authorAssociation ?? 'NONE',
        author: node.author ?? { login: 'ghost', avatarUrl: '' },
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        reactionGroups: toReactionGroups(node.reactionGroups ?? []),
      }
    case 'LabeledEvent':
      return { type: 'LabeledEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', label: node.label }
    case 'UnlabeledEvent':
      return { type: 'UnlabeledEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', label: node.label }
    case 'AssignedEvent':
      return { type: 'AssignedEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', assignee: node.assignee?.login ?? 'unknown' }
    case 'UnassignedEvent':
      return { type: 'UnassignedEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', assignee: node.assignee?.login ?? 'unknown' }
    case 'ClosedEvent':
      return { type: 'ClosedEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', stateReason: node.stateReason ?? null }
    case 'ReopenedEvent':
      return { type: 'ReopenedEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost' }
    case 'CrossReferencedEvent':
      if (!node.source) return null
      return {
        type: 'CrossReferencedEvent',
        createdAt: node.createdAt,
        actor: node.actor?.login ?? 'ghost',
        source: {
          type: node.source.__typename === 'PullRequest' ? 'PullRequest' : 'Issue',
          number: node.source.number,
          title: node.source.title,
          url: node.source.url,
          state: node.source.state,
        },
      }
    case 'MilestonedEvent':
      return { type: 'MilestonedEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', milestoneTitle: node.milestoneTitle }
    case 'RenamedTitleEvent':
      return { type: 'RenamedTitleEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', previousTitle: node.previousTitle, currentTitle: node.currentTitle }
    case 'ReferencedEvent':
      if (!node.commit) return null
      return { type: 'ReferencedEvent', createdAt: node.createdAt, actor: node.actor?.login ?? 'ghost', commitId: node.commit.oid, commitMessage: node.commit.message }
    default:
      return null
  }
}

function toIssueDetail(node: GraphQLIssueDetailNode, timeline: TimelineItem[]): IssueDetail {
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    body: node.body,
    bodyHTML: node.bodyHTML,
    authorAssociation: node.authorAssociation,
    state: node.state,
    stateReason: node.stateReason,
    url: node.url,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    locked: node.locked,
    author: node.author ?? { login: 'ghost', avatarUrl: '' },
    labels: node.labels.nodes,
    assignees: node.assignees.nodes,
    milestone: node.milestone?.title ?? null,
    reactionGroups: toReactionGroups(node.reactionGroups),
    timeline,
  }
}

const fetchIssueDetail = defineCachedFunction(
  async (_login: string, token: string, owner: string, repo: string, number: number): Promise<IssueDetail> => {
    const timeline: TimelineItem[] = []
    let after: string | null = null
    let issueNode: GraphQLIssueDetailNode | null = null

    // Paginate timeline (up to 5 pages = 500 items)
    for (let page = 0; page < 5; page++) {
      const data: GraphQLIssueDetailResult = await githubGraphQL<GraphQLIssueDetailResult>(token, ISSUE_DETAIL_QUERY, {
        owner,
        repo,
        number,
        first: 100,
        after,
      })

      const node = data.repository.issue
      issueNode = node
      const items = node.timelineItems.nodes
        .map(toTimelineItem)
        .filter((item): item is TimelineItem => item !== null)
      timeline.push(...items)

      if (!node.timelineItems.pageInfo.hasNextPage) break
      after = node.timelineItems.pageInfo.endCursor
    }

    if (!issueNode) {
      throw createError({ statusCode: 404, message: 'Issue not found' })
    }

    return toIssueDetail(issueNode, timeline)
  },
  {
    maxAge: 30,
    name: 'issue-detail',
    getKey: (login: string, _token: string, owner: string, repo: string, number: number) =>
      `${login}:${owner}/${repo}#${number}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { repo } = getQuery<{ repo?: string }>(event)
  const number = Number(getRouterParam(event, 'number'))

  if (!repo) {
    throw createError({ statusCode: 400, message: 'Missing repo query parameter' })
  }
  if (!number || Number.isNaN(number)) {
    throw createError({ statusCode: 400, message: 'Invalid issue number' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format, expected owner/repo' })
  }

  return fetchIssueDetail(login, token, owner, repoName, number)
})
