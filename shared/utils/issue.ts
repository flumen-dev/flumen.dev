import type { GraphQLIssueNode, Issue } from '../types/issue'

const SNIPPET_MAX = 80

/** Strip the heaviest markdown noise so a comment body reads as plain text in a row. */
function cleanSnippet(body: string | null | undefined, maxLen: number): string {
  if (typeof body !== 'string' || !body) return ''
  const stripped = body
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[image]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length <= maxLen) return stripped
  return stripped.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

export function toIssue(node: GraphQLIssueNode, maintainerLogin: string): Issue {
  const commentNodes = node.comments.nodes
  // GraphQL `comments(last: 5)` returns the most-recent run in chronological order,
  // so the final element is the latest comment.
  const lastNode = commentNodes.length ? commentNodes[commentNodes.length - 1] : null
  const snippet = cleanSnippet(lastNode?.body, SNIPPET_MAX)
  const lastComment = lastNode && lastNode.author && snippet
    ? {
        author: lastNode.author,
        snippet,
        createdAt: lastNode.createdAt,
      }
    : null

  return {
    id: node.id,
    number: node.number,
    title: node.title,
    state: node.state,
    stateReason: node.stateReason,
    url: node.url,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    closedAt: node.closedAt,
    author: node.author ?? { login: 'ghost', avatarUrl: '' },
    labels: node.labels.nodes,
    assignees: node.assignees.nodes,
    milestone: node.milestone?.title ?? null,
    commentCount: node.comments.totalCount,
    linkedPrCount: node.timelineItems.totalCount,
    maintainerCommented: commentNodes.some(c => c.author?.login === maintainerLogin),
    lastComment,
    repository: {
      nameWithOwner: node.repository.nameWithOwner,
      name: node.repository.name,
      owner: node.repository.owner.login,
    },
  }
}
