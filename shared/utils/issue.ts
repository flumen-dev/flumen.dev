import type { GraphQLIssueNode, Issue } from '../types/issue'

export function toIssue(node: GraphQLIssueNode, maintainerLogin: string): Issue {
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
    maintainerCommented: node.comments.nodes.some(c => c.author?.login === maintainerLogin),
    repository: {
      nameWithOwner: node.repository.nameWithOwner,
      name: node.repository.name,
      owner: node.repository.owner.login,
    },
  }
}
