import type { ReviewComment, Reviewer, WorkItemContribution, WorkItemDetail, WorkItemTimelineEntry } from '~~/shared/types/work-item'
import { githubGraphQL } from '~~/server/utils/github-graphql'
import { getRepoParams, getSessionToken } from '~~/server/utils/github'
import { mapCiStatus } from '~~/server/utils/focus-created'
import { parseWorkItemId } from '~~/server/utils/work-items'
import { buildReplyMap, injectReplies, mapReactionGroups } from '~~/server/utils/review-replies'
import type { ReviewThreadNode } from '~~/server/utils/review-replies'

const ISSUE_DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      number
      title
      state
      url
      body
      bodyHTML
      createdAt
      updatedAt
      viewerCanUpdate
      author { login avatarUrl }
      comments { totalCount }
      reactionGroups {
        content
        viewerHasReacted
        reactors { totalCount }
      }
      labels(first: 20) { nodes { name color } }
      assignees(first: 20) { nodes { login avatarUrl } }
      timelineItems(first: 100) {
        nodes {
          __typename
          ... on IssueComment {
            id
            body
            createdAt
            author { login avatarUrl }
            viewerCanUpdate
            viewerCanDelete
            reactionGroups {
              content
              viewerHasReacted
              reactors { totalCount }
            }
          }
          ... on ClosedEvent {
            createdAt
            actor { login avatarUrl }
          }
          ... on ReopenedEvent {
            createdAt
            actor { login avatarUrl }
          }
          ... on LabeledEvent {
            createdAt
            actor { login avatarUrl }
            label { name }
          }
          ... on UnlabeledEvent {
            createdAt
            actor { login avatarUrl }
            label { name }
          }
          ... on AssignedEvent {
            createdAt
            actor { login avatarUrl }
            assignee { ... on User { login } }
          }
          ... on UnassignedEvent {
            createdAt
            actor { login avatarUrl }
            assignee { ... on User { login } }
          }
          ... on CrossReferencedEvent {
            id
            createdAt
            source {
              __typename
              ... on PullRequest {
                number
                title
                state
                url
                isDraft
                updatedAt
                reviewDecision
                comments { totalCount }
                labels(first: 20) { nodes { name color } }
                assignees(first: 20) { nodes { login avatarUrl } }
                closingIssuesReferences(first: 20) {
                  nodes { number }
                }
                commits(last: 1) {
                  nodes { commit { statusCheckRollup { state } } }
                }
              }
            }
          }
        }
      }
    }
  }
}
`

const PULL_DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      id
      number
      title
      state
      url
      isDraft
      body
      bodyHTML
      createdAt
      updatedAt
      viewerCanUpdate
      reviewDecision
      headRefName
      headRepository { owner { login } name }
      author { login avatarUrl }
      comments { totalCount }
      reactionGroups {
        content
        viewerHasReacted
        reactors { totalCount }
      }
      labels(first: 20) { nodes { name color } }
      assignees(first: 20) { nodes { login avatarUrl } }
      commits(last: 1) {
        nodes { commit { statusCheckRollup { state } } }
      }
      timelineItems(first: 100) {
        nodes {
          __typename
          ... on IssueComment {
            id
            body
            createdAt
            author { login avatarUrl }
            viewerCanUpdate
            viewerCanDelete
            reactionGroups {
              content
              viewerHasReacted
              reactors { totalCount }
            }
          }
          ... on PullRequestReview {
            id
            body
            state
            submittedAt
            author { login avatarUrl }
            viewerCanUpdate
            viewerCanDelete
            reactionGroups {
              content
              viewerHasReacted
              reactors { totalCount }
            }
            comments(first: 50) {
              nodes {
                id
                databaseId
                body
                path
                line
                startLine
                originalLine
                originalStartLine
                diffHunk
                outdated
                createdAt
                author { login avatarUrl }
                viewerCanUpdate
                viewerCanDelete
                replyTo { id }
                reactionGroups {
                  content
                  viewerHasReacted
                  reactors { totalCount }
                }
              }
            }
          }
          ... on ClosedEvent {
            createdAt
            actor { login avatarUrl }
          }
          ... on ReopenedEvent {
            createdAt
            actor { login avatarUrl }
          }
          ... on MergedEvent {
            createdAt
            actor { login avatarUrl }
          }
          ... on LabeledEvent {
            createdAt
            actor { login avatarUrl }
            label { name }
          }
          ... on UnlabeledEvent {
            createdAt
            actor { login avatarUrl }
            label { name }
          }
          ... on AssignedEvent {
            createdAt
            actor { login avatarUrl }
            assignee { ... on User { login } }
          }
          ... on UnassignedEvent {
            createdAt
            actor { login avatarUrl }
            assignee { ... on User { login } }
          }
        }
      }
      reviewThreads(first: 100) {
        nodes {
          id
          comments(first: 30) {
            nodes {
              id
              databaseId
              body
              path
              line
              startLine
              originalLine
              originalStartLine
              diffHunk
              outdated
              createdAt
              author { login avatarUrl }
              viewerCanUpdate
              viewerCanDelete
              reactionGroups {
                content
                viewerHasReacted
                reactors { totalCount }
              }
            }
          }
        }
      }
      reviewRequests(first: 20) {
        nodes {
          requestedReviewer {
            ... on User { login avatarUrl }
            ... on Team { slug avatarUrl }
          }
        }
      }
      latestReviews(first: 20) {
        nodes {
          author { login avatarUrl }
          state
        }
      }
      closingIssuesReferences(first: 20) {
        nodes {
          number
          title
          state
          url
        }
      }
    }
  }
}
`

function normalizeState(state: string, isDraft = false): string {
  if (isDraft) return 'DRAFT'
  return state
}

interface TimelineActor {
  login?: string
  avatarUrl?: string
}

interface TimelineNode {
  __typename?: string
  id?: string
  createdAt?: string
  submittedAt?: string
  body?: string
  state?: string
  author?: TimelineActor | null
  actor?: TimelineActor | null
  label?: { name?: string } | null
  assignee?: { login?: string } | null
  source?: PullDetailNode | null
  viewerCanUpdate?: boolean
  viewerCanDelete?: boolean
  reactionGroups?: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>
  comments?: {
    nodes?: Array<{
      id: string
      body: string
      path: string
      line: number | null
      startLine?: number | null
      originalLine?: number | null
      originalStartLine?: number | null
      diffHunk?: string | null
      outdated?: boolean | null
      createdAt: string
      author: TimelineActor | null
      databaseId?: number | null
      viewerCanUpdate?: boolean
      viewerCanDelete?: boolean
      replyTo?: { id: string } | null
      reactionGroups?: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>
    }>
  }
}

interface IssueDetailNode {
  id: string
  number: number
  title: string
  state: string
  url: string
  body: string
  bodyHTML: string
  createdAt: string
  updatedAt: string
  viewerCanUpdate?: boolean
  author: TimelineActor | null
  comments?: { totalCount?: number }
  reactionGroups?: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>
  labels?: { nodes?: Array<{ name: string, color: string }> }
  assignees?: { nodes?: Array<{ login: string, avatarUrl: string }> }
  timelineItems: { nodes: TimelineNode[] }
}

interface PullDetailNode {
  __typename?: string
  id: string
  number: number
  title: string
  state: string
  url: string
  isDraft?: boolean
  viewerCanUpdate?: boolean
  headRefName?: string
  headRepository?: { owner: { login: string }, name: string } | null
  body: string
  bodyHTML: string
  createdAt: string
  updatedAt: string
  reviewDecision?: WorkItemDetail['reviewDecision']
  author: TimelineActor | null
  comments?: { totalCount?: number }
  reactionGroups?: Array<{ content: string, viewerHasReacted: boolean, reactors: { totalCount: number } }>
  labels?: { nodes?: Array<{ name: string, color: string }> }
  assignees?: { nodes?: Array<{ login: string, avatarUrl: string }> }
  commits?: { nodes?: Array<{ commit?: { statusCheckRollup?: { state?: string } } }> }
  timelineItems?: { nodes?: TimelineNode[] }
  reviewThreads?: { nodes?: Array<ReviewThreadNode> }
  reviewRequests?: { nodes?: Array<{ requestedReviewer?: { login?: string, slug?: string, avatarUrl?: string } | null }> }
  latestReviews?: { nodes?: Array<{ author?: { login?: string, avatarUrl?: string } | null, state?: string }> }
  closingIssuesReferences: { nodes: Array<{ number: number, title: string, state: string, url: string }> }
}

function normalizeAuthor(actor: TimelineActor | null | undefined) {
  return {
    login: actor?.login ?? 'ghost',
    avatarUrl: actor?.avatarUrl ?? '',
  }
}

function mapIssueTimeline(node: TimelineNode, issueNumber: number): WorkItemTimelineEntry | null {
  const createdAt = node.createdAt
  if (!createdAt) return null

  const base = {
    id: `${issueNumber}-${node.__typename}-${node.id ?? node.createdAt}`,
    source: 'issue' as const,
    sourceNumber: issueNumber,
    author: node.author?.login ?? node.actor?.login ?? 'ghost',
    authorAvatarUrl: node.author?.avatarUrl ?? node.actor?.avatarUrl,
    createdAt,
  }

  if (node.__typename === 'IssueComment') {
    return {
      ...base,
      subjectId: node.id,
      kind: 'comment',
      body: node.body,
      reactionGroups: mapReactionGroups(node.reactionGroups),
      viewerCanUpdate: node.viewerCanUpdate,
      viewerCanDelete: node.viewerCanDelete,
    }
  }

  if (node.__typename === 'LabeledEvent' || node.__typename === 'UnlabeledEvent') {
    return {
      ...base,
      kind: 'label',
      labelName: node.label?.name,
      state: node.__typename === 'LabeledEvent' ? 'LABELED' : 'UNLABELED',
    }
  }

  if (node.__typename === 'AssignedEvent' || node.__typename === 'UnassignedEvent') {
    return {
      ...base,
      kind: 'assignment',
      assignee: node.assignee?.login,
      state: node.__typename === 'AssignedEvent' ? 'ASSIGNED' : 'UNASSIGNED',
    }
  }

  if (node.__typename === 'ClosedEvent' || node.__typename === 'ReopenedEvent') {
    return {
      ...base,
      kind: 'state',
      state: node.__typename === 'ClosedEvent' ? 'CLOSED' : 'REOPENED',
    }
  }

  return null
}

function mapPullTimeline(node: TimelineNode, pullNumber: number): WorkItemTimelineEntry | null {
  const createdAt = node.createdAt ?? node.submittedAt
  if (!createdAt) return null

  const base = {
    id: `${pullNumber}-${node.__typename}-${node.id ?? createdAt}`,
    source: 'pull' as const,
    sourceNumber: pullNumber,
    author: node.author?.login ?? node.actor?.login ?? 'ghost',
    authorAvatarUrl: node.author?.avatarUrl ?? node.actor?.avatarUrl,
    createdAt,
  }

  if (node.__typename === 'IssueComment') {
    return {
      ...base,
      subjectId: node.id,
      kind: 'comment',
      body: node.body,
      reactionGroups: mapReactionGroups(node.reactionGroups),
      viewerCanUpdate: node.viewerCanUpdate,
      viewerCanDelete: node.viewerCanDelete,
    }
  }

  if (node.__typename === 'PullRequestReview') {
    const allComments = node.comments?.nodes ?? []

    // Only keep root comments (no replyTo); replies are injected later via reviewThreads
    const reviewComments: ReviewComment[] = allComments
      .filter(comment => !comment.replyTo?.id)
      .map(comment => ({
        id: comment.id,
        databaseId: comment.databaseId ?? undefined,
        path: comment.path,
        line: comment.line ?? comment.originalLine ?? null,
        startLine: (comment.startLine ?? comment.originalStartLine) ?? undefined,
        diffHunk: comment.diffHunk ?? undefined,
        outdated: comment.outdated ?? undefined,
        body: comment.body,
        author: comment.author?.login ?? 'ghost',
        authorAvatarUrl: comment.author?.avatarUrl,
        createdAt: comment.createdAt,
        reactionGroups: mapReactionGroups(comment.reactionGroups),
        viewerCanUpdate: comment.viewerCanUpdate,
        viewerCanDelete: comment.viewerCanDelete,
      }))

    return {
      ...base,
      subjectId: node.id,
      kind: 'review',
      body: node.body,
      reactionGroups: mapReactionGroups(node.reactionGroups),
      reviewState: node.state,
      state: node.state,
      ...(reviewComments.length > 0 ? { reviewComments } : {}),
    }
  }

  if (node.__typename === 'MergedEvent' || node.__typename === 'ClosedEvent' || node.__typename === 'ReopenedEvent') {
    return {
      ...base,
      kind: 'state',
      state: node.__typename === 'MergedEvent'
        ? 'MERGED'
        : node.__typename === 'ClosedEvent'
          ? 'CLOSED'
          : 'REOPENED',
    }
  }

  if (node.__typename === 'LabeledEvent' || node.__typename === 'UnlabeledEvent') {
    return {
      ...base,
      kind: 'label',
      labelName: node.label?.name,
      state: node.__typename === 'LabeledEvent' ? 'LABELED' : 'UNLABELED',
    }
  }

  if (node.__typename === 'AssignedEvent' || node.__typename === 'UnassignedEvent') {
    return {
      ...base,
      kind: 'assignment',
      assignee: node.assignee?.login,
      state: node.__typename === 'AssignedEvent' ? 'ASSIGNED' : 'UNASSIGNED',
    }
  }

  return null
}

function createInitialIssueEntry(issue: IssueDetailNode): WorkItemTimelineEntry {
  return {
    id: `${issue.number}-IssueOpened-${issue.createdAt}`,
    subjectId: issue.id,
    source: 'issue',
    sourceNumber: issue.number,
    kind: 'comment',
    isInitial: true,
    author: issue.author?.login ?? 'ghost',
    authorAvatarUrl: issue.author?.avatarUrl,
    createdAt: issue.createdAt,
    body: issue.body,
    reactionGroups: mapReactionGroups(issue.reactionGroups),
    viewerCanUpdate: issue.viewerCanUpdate,
  }
}

function createInitialPullEntry(pull: PullDetailNode): WorkItemTimelineEntry {
  return {
    id: `${pull.number}-PullOpened-${pull.createdAt}`,
    subjectId: pull.id,
    source: 'pull',
    sourceNumber: pull.number,
    kind: 'comment',
    isInitial: true,
    author: pull.author?.login ?? 'ghost',
    authorAvatarUrl: pull.author?.avatarUrl,
    createdAt: pull.createdAt,
    body: pull.body,
    reactionGroups: mapReactionGroups(pull.reactionGroups),
    viewerCanUpdate: pull.viewerCanUpdate,
  }
}

function mapReviewers(pull: PullDetailNode): Reviewer[] {
  const reviewerMap = new Map<string, Reviewer>()

  // Add reviewers who already submitted reviews (latest state wins)
  for (const node of pull.latestReviews?.nodes ?? []) {
    const login = node.author?.login
    if (!login) continue
    reviewerMap.set(login, {
      login,
      avatarUrl: node.author?.avatarUrl ?? '',
      state: (node.state as Reviewer['state']) ?? 'COMMENTED',
    })
  }

  // Add pending review requests (only if they haven't already reviewed)
  for (const node of pull.reviewRequests?.nodes ?? []) {
    const reviewer = node.requestedReviewer
    const login = reviewer?.login ?? reviewer?.slug
    if (!login) continue
    if (!reviewerMap.has(login)) {
      reviewerMap.set(login, {
        login,
        avatarUrl: reviewer?.avatarUrl ?? '',
        state: 'PENDING',
      })
    }
  }

  return Array.from(reviewerMap.values())
}

const fetchWorkItemDetail = defineCachedFunction(
  async (login: string, token: string, owner: string, repo: string, id: string): Promise<WorkItemDetail> => {
    const parsed = parseWorkItemId(id)

    if (parsed.type === 'issue') {
      const data = await githubGraphQL<{ repository?: { issue?: IssueDetailNode | null } }>(token, ISSUE_DETAIL_QUERY, {
        owner,
        repo,
        number: parsed.number,
      })

      const issue = data.repository?.issue
      if (!issue) {
        throw createError({ statusCode: 404, message: 'Work item not found' })
      }

      const linkedPulls = issue.timelineItems.nodes
        .filter((node) => {
          if (node.__typename !== 'CrossReferencedEvent' || node.source?.__typename !== 'PullRequest') return false
          const closingIssues = node.source?.closingIssuesReferences?.nodes ?? []
          return closingIssues.some((linkedIssue: { number: number }) => linkedIssue.number === issue.number)
        })
      const linkedPullMap = new Map<number, {
        type: 'pull'
        number: number
        title: string
        state: string
        isDraft: boolean
        htmlUrl: string
      }>()

      linkedPulls.forEach((node) => {
        const pull = node.source
        if (!pull) return

        if (!linkedPullMap.has(pull.number)) {
          linkedPullMap.set(pull.number, {
            type: 'pull',
            number: pull.number,
            title: pull.title,
            state: pull.state,
            isDraft: pull.isDraft ?? false,
            htmlUrl: pull.url,
          })
        }
      })

      const dedupedLinkedPulls = Array.from(linkedPullMap.values())
      const linkedPullNumbers = Array.from(linkedPullMap.keys())
      const contributions: WorkItemContribution[] = []
      const pullTimelineEntries: WorkItemTimelineEntry[] = []

      const pullResponses = await Promise.allSettled(
        linkedPullNumbers.map(async (pullNumber) => {
          const pullData = await githubGraphQL<{ repository?: { pullRequest?: PullDetailNode | null } }>(token, PULL_DETAIL_QUERY, {
            owner,
            repo,
            number: pullNumber,
          })

          return pullData.repository?.pullRequest ?? null
        }),
      )

      pullResponses.forEach((pullResponse, index) => {
        const pullNumber = linkedPullNumbers[index]
        if (!pullNumber) return

        if (pullResponse.status === 'rejected') {
          console.error('[work-item-detail] Failed to fetch linked pull', {
            owner,
            repo,
            issueNumber: issue.number,
            pullNumber,
            error: pullResponse.reason,
          })
          return
        }

        const pull = pullResponse.value
        if (!pull) return

        const ciRaw = pull.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
        contributions.push({
          subjectId: pull.id,
          number: pull.number,
          title: pull.title,
          state: pull.state,
          url: pull.url,
          isDraft: pull.isDraft ?? false,
          reviewDecision: pull.reviewDecision ?? null,
          ciStatus: mapCiStatus(ciRaw),
          updatedAt: pull.updatedAt,
        })

        pullTimelineEntries.push(createInitialPullEntry(pull))

        const pullEntries = (pull.timelineItems?.nodes ?? [])
          .map((node: TimelineNode) => mapPullTimeline(node, pull.number))
          .filter((entry: WorkItemTimelineEntry | null): entry is WorkItemTimelineEntry => entry !== null)

        const pullReplyMap = buildReplyMap(pull.reviewThreads?.nodes ?? [])
        injectReplies(pullEntries, pullReplyMap)

        pullEntries.forEach((entry: WorkItemTimelineEntry) => {
          pullTimelineEntries.push(entry)
        })
      })

      const issueInitialEntry = createInitialIssueEntry(issue)
      const issueTimelineEntries = issue.timelineItems.nodes
        .map(node => mapIssueTimeline(node, issue.number))
        .filter((entry: WorkItemTimelineEntry | null): entry is WorkItemTimelineEntry => entry !== null)

      const timeline = [issueInitialEntry, ...issueTimelineEntries, ...pullTimelineEntries]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      const firstContribution = contributions[0]

      return {
        id,
        type: 'issue',
        primaryType: 'issue',
        number: issue.number,
        title: issue.title,
        state: normalizeState(issue.state),
        htmlUrl: issue.url,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        author: normalizeAuthor(issue.author),
        labels: issue.labels?.nodes ?? [],
        assignees: issue.assignees?.nodes ?? [],
        commentCount: issue.comments?.totalCount ?? 0,
        isDraft: firstContribution?.isDraft ?? false,
        reviewDecision: firstContribution?.reviewDecision ?? null,
        ciStatus: firstContribution?.ciStatus ?? null,
        issue: null,
        pull: null,
        linkedPulls: dedupedLinkedPulls,
        linkedIssues: [],
        body: issue.body,
        bodyHTML: issue.bodyHTML,
        url: issue.url,
        repo: `${owner}/${repo}`,
        contributions,
        timeline,
      }
    }

    const data = await githubGraphQL<{ repository?: { pullRequest?: PullDetailNode | null } }>(token, PULL_DETAIL_QUERY, {
      owner,
      repo,
      number: parsed.number,
    })

    const pull = data.repository?.pullRequest
    if (!pull) {
      throw createError({ statusCode: 404, message: 'Work item not found' })
    }

    const ciRaw = pull.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
    const pullInitialEntry = createInitialPullEntry(pull)
    const timeline = (pull.timelineItems?.nodes ?? [])
      .map(node => mapPullTimeline(node, pull.number))
      .filter((entry: WorkItemTimelineEntry | null): entry is WorkItemTimelineEntry => entry !== null)
    const unifiedPullTimeline = [pullInitialEntry, ...timeline]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const replyMap = buildReplyMap(pull.reviewThreads?.nodes ?? [])
    injectReplies(unifiedPullTimeline, replyMap)

    const reviewSummary = unifiedPullTimeline
      .filter(item => item.kind === 'review')
      .reduce(
        (acc, item) => {
          if (item.reviewState === 'APPROVED') acc.approved += 1
          else if (item.reviewState === 'CHANGES_REQUESTED') acc.changesRequested += 1
          else acc.commented += 1
          return acc
        },
        { approved: 0, changesRequested: 0, commented: 0 },
      )

    return {
      id,
      type: 'pull',
      primaryType: 'pull',
      number: pull.number,
      title: pull.title,
      state: normalizeState(pull.state, pull.isDraft ?? false),
      htmlUrl: pull.url,
      createdAt: pull.createdAt,
      updatedAt: pull.updatedAt,
      author: normalizeAuthor(pull.author),
      labels: pull.labels?.nodes ?? [],
      assignees: pull.assignees?.nodes ?? [],
      commentCount: pull.comments?.totalCount ?? 0,
      isDraft: pull.isDraft ?? false,
      reviewDecision: pull.reviewDecision ?? null,
      ciStatus: mapCiStatus(ciRaw),
      issue: null,
      pull: null,
      linkedPulls: [],
      linkedIssues: pull.closingIssuesReferences.nodes.map(node => ({
        type: 'issue',
        number: node.number,
        title: node.title,
        state: node.state,
        htmlUrl: node.url,
      })),
      body: pull.body,
      bodyHTML: pull.bodyHTML,
      url: pull.url,
      repo: `${owner}/${repo}`,
      contributions: [],
      timeline: unifiedPullTimeline,
      headBranch: pull.headRefName ?? null,
      headBranchRepo: pull.headRepository ? `${pull.headRepository.owner.login}/${pull.headRepository.name}` : null,
      reviewSummary,
      reviewers: mapReviewers(pull),
    }
  },
  {
    maxAge: 60,
    name: 'repo-work-item-detail',
    getKey: (login: string, _token: string, owner: string, repo: string, id: string) => `${login}:${owner}/${repo}:${id}`,
  },
)

export default defineEventHandler(async (event) => {
  const { token, login } = await getSessionToken(event)
  const { owner, repo } = getRepoParams(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing work item id' })
  }

  return fetchWorkItemDetail(login, token, owner, repo, id)
})
