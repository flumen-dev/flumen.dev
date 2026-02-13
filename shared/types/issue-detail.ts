// --- Timeline item types (flattened from GraphQL union) ---

interface TimelineBase {
  createdAt: string
}

export interface TimelineComment extends TimelineBase {
  type: 'IssueComment'
  id: string
  body: string
  bodyHTML: string
  authorAssociation: AuthorAssociation
  author: { login: string, avatarUrl: string }
  updatedAt: string
  reactionGroups: ReactionGroup[]
}

export interface TimelineLabeledEvent extends TimelineBase {
  type: 'LabeledEvent'
  actor: string
  label: { name: string, color: string }
}

export interface TimelineUnlabeledEvent extends TimelineBase {
  type: 'UnlabeledEvent'
  actor: string
  label: { name: string, color: string }
}

export interface TimelineAssignedEvent extends TimelineBase {
  type: 'AssignedEvent'
  actor: string
  assignee: string
}

export interface TimelineUnassignedEvent extends TimelineBase {
  type: 'UnassignedEvent'
  actor: string
  assignee: string
}

export interface TimelineClosedEvent extends TimelineBase {
  type: 'ClosedEvent'
  actor: string
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | null
}

export interface TimelineReopenedEvent extends TimelineBase {
  type: 'ReopenedEvent'
  actor: string
}

export interface TimelineCrossReferencedEvent extends TimelineBase {
  type: 'CrossReferencedEvent'
  actor: string
  source: {
    type: 'PullRequest' | 'Issue'
    number: number
    title: string
    url: string
    state: string
  }
}

export interface TimelineMilestonedEvent extends TimelineBase {
  type: 'MilestonedEvent'
  actor: string
  milestoneTitle: string
}

export interface TimelineRenamedTitleEvent extends TimelineBase {
  type: 'RenamedTitleEvent'
  actor: string
  previousTitle: string
  currentTitle: string
}

export interface TimelineReferencedEvent extends TimelineBase {
  type: 'ReferencedEvent'
  actor: string
  commitId: string
  commitMessage: string
}

export type TimelineItem = TimelineComment
  | TimelineLabeledEvent
  | TimelineUnlabeledEvent
  | TimelineAssignedEvent
  | TimelineUnassignedEvent
  | TimelineClosedEvent
  | TimelineReopenedEvent
  | TimelineCrossReferencedEvent
  | TimelineMilestonedEvent
  | TimelineRenamedTitleEvent
  | TimelineReferencedEvent

// --- Reaction groups ---

export interface ReactionGroup {
  content: string
  count: number
}

// --- Issue detail (full single issue) ---

export type AuthorAssociation = 'OWNER' | 'MEMBER' | 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIMER' | 'FIRST_TIME_CONTRIBUTOR' | 'MANNEQUIN' | 'NONE'

export interface IssueDetail {
  id: string
  number: number
  title: string
  body: string
  bodyHTML: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  locked: boolean
  authorAssociation: AuthorAssociation

  author: {
    login: string
    avatarUrl: string
  }

  labels: Array<{
    name: string
    color: string
  }>

  assignees: Array<{
    login: string
    avatarUrl: string
  }>

  milestone: string | null
  reactionGroups: ReactionGroup[]

  timeline: TimelineItem[]
}

// --- GraphQL response shape ---

export interface GraphQLIssueDetailResult {
  repository: {
    issue: GraphQLIssueDetailNode
  }
}

export interface GraphQLIssueDetailNode {
  id: string
  number: number
  title: string
  body: string
  bodyHTML: string
  state: 'OPEN' | 'CLOSED'
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | null
  url: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  locked: boolean
  authorAssociation: AuthorAssociation
  author: { login: string, avatarUrl: string } | null
  labels: { nodes: Array<{ name: string, color: string }> }
  assignees: { nodes: Array<{ login: string, avatarUrl: string }> }
  milestone: { title: string } | null
  reactionGroups: Array<{ content: string, reactors: { totalCount: number } }>
  timelineItems: {
    pageInfo: { hasNextPage: boolean, endCursor: string | null }
    nodes: Array<GraphQLTimelineNode>
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GraphQLTimelineNode = { __typename: string } & Record<string, any>
