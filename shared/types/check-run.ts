import type { WorkItemCiStatus } from './work-item'

export interface CheckRunDetail {
  name: string
  status: WorkItemCiStatus
  durationSeconds: number | null
  detailsUrl: string | null
  jobId: number | null
}

export interface CheckRunsResult {
  rollupStatus: WorkItemCiStatus
  total: number
  passed: number
  failed: number
  pending: number
  checks: CheckRunDetail[]
  failingNames: string[]
}
