export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  totalCount: number
  pageInfo: PageInfo
}
