import type { WorkItem } from '~~/shared/types/work-item'

export type WorkItemsSortKey = 'newest' | 'oldest' | 'mostCommented' | 'leastCommented' | 'recentlyUpdated'

export interface WorkItemsQueryOptions {
  search?: string
  filters?: string[]
  sort?: WorkItemsSortKey
}

export interface WorkItemsQueryResult {
  items: WorkItem[]
  availableLabels: string[]
}

export function parseWorkItemFilters(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[|,]/)
    .map(v => v.trim())
    .filter(Boolean)
}

export function resolveWorkItemsSort(raw: string | undefined): WorkItemsSortKey {
  const allowed: WorkItemsSortKey[] = ['newest', 'oldest', 'mostCommented', 'leastCommented', 'recentlyUpdated']
  if (raw && allowed.includes(raw as WorkItemsSortKey)) {
    return raw as WorkItemsSortKey
  }
  return 'newest'
}

export function applyWorkItemsQuery(allItems: WorkItem[], options: WorkItemsQueryOptions): WorkItemsQueryResult {
  let items = allItems

  const set = new Set(allItems.flatMap(item => item.labels.map(l => l.name)))
  const availableLabels = [...set].sort()

  const search = options.search?.trim().toLowerCase()
  if (search) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(search)
      || `#${item.number}`.includes(search)
      || item.author.login.toLowerCase().includes(search),
    )
  }

  const filters = options.filters ?? []
  if (filters.length) {
    const labelFilters = filters.filter(f => f.startsWith('label:')).map(f => f.slice(6))
    if (labelFilters.length) {
      items = items.filter(item => labelFilters.every(lf => item.labels.some(l => l.name === lf)))
    }

    if (filters.includes('type:issue')) {
      items = items.filter(item => item.type === 'issue')
    }
    if (filters.includes('type:pull')) {
      items = items.filter(item => item.type === 'pull' || item.linkedPulls.length > 0)
    }
  }

  const sort = options.sort ?? 'newest'
  const sorted = [...items].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (sort === 'mostCommented') return b.commentCount - a.commentCount
    if (sort === 'leastCommented') return a.commentCount - b.commentCount
    if (sort === 'recentlyUpdated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return { items: sorted, availableLabels }
}
