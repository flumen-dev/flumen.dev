import type { CheckRunDetail } from '~~/shared/types/check-run'
import { mapCiStatus } from './focus-created'

export interface CheckRunNode {
  __typename: 'CheckRun'
  databaseId: number
  name: string
  conclusion: string | null
  status: string
  startedAt: string | null
  completedAt: string | null
  detailsUrl: string | null
}

export interface StatusContextNode {
  __typename: 'StatusContext'
  context: string
  state: string
  targetUrl: string | null
  createdAt: string | null
}

export type ContextNode = CheckRunNode | StatusContextNode

export function mapContextNode(node: ContextNode): CheckRunDetail {
  if (node.__typename === 'CheckRun') {
    let status = mapCiStatus(node.conclusion)
    if (!status && node.status === 'IN_PROGRESS') status = 'PENDING'
    if (!status && node.status === 'QUEUED') status = 'PENDING'
    if (!status && node.status === 'COMPLETED') status = 'FAILURE'

    let durationSeconds: number | null = null
    if (node.startedAt && node.completedAt) {
      durationSeconds = Math.round(
        (new Date(node.completedAt).getTime() - new Date(node.startedAt).getTime()) / 1000,
      )
    }

    return {
      name: node.name,
      status,
      durationSeconds,
      detailsUrl: node.detailsUrl,
      jobId: node.databaseId,
    }
  }

  const stateMap: Record<string, ReturnType<typeof mapCiStatus>> = {
    SUCCESS: 'SUCCESS',
    PENDING: 'PENDING',
    FAILURE: 'FAILURE',
    ERROR: 'FAILURE',
    EXPECTED: 'PENDING',
  }

  return {
    name: node.context,
    status: stateMap[node.state] ?? null,
    durationSeconds: null,
    detailsUrl: node.targetUrl,
    jobId: null,
  }
}
