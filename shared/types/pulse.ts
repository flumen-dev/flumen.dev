export interface PulseItem {
  title: string
  number: number
  repo: string
  url: string
  type: 'issue' | 'pr'
}

export interface PulseDay {
  date: string
  incoming: number
  resolved: number
  incomingItems: PulseItem[]
  resolvedItems: PulseItem[]
}

export interface PulseResponse {
  days: PulseDay[]
  totals: {
    incoming: number
    issuesClosed: number
    prsMerged: number
    resolved: number
    ratio: number
  }
}
