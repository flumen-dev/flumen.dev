/**
 * Smart issue detail composable:
 * - Server: defineCachedFunction (30s) prevents GitHub API spam
 * - Client: getCachedData serves from payload on SPA navigation
 * - Mutations: optimistic local update + clearNuxtData for next visit
 * - Scroll position preserved on refresh
 */
export function useIssueDetail(repo: Ref<string | undefined>, number: Ref<number>) {
  const apiFetch = useRequestFetch()
  const nuxtApp = useNuxtApp()

  const cacheKey = computed(() => `issue-${repo.value}-${number.value}`)

  const { data: issue, status, error, refresh } = useAsyncData(
    () => cacheKey.value,
    () => {
      if (!repo.value || !number.value) {
        throw createError({ statusCode: 400, message: 'Missing repo or issue number' })
      }
      return apiFetch<IssueDetail>(`/api/issues/${number.value}`, {
        params: { repo: repo.value },
      })
    },
    {
      watch: [repo, number],
      getCachedData: (key) => {
        return nuxtApp.payload.data[key] as IssueDetail | undefined
          ?? nuxtApp.static.data[key] as IssueDetail | undefined
      },
    },
  )

  // After a mutation: clear the client cache so next navigation refetches.
  // The current issue.value keeps the optimistic state until then.
  function invalidateCache() {
    // Remove from payload so getCachedData won't find stale data
    nuxtApp.payload.data[cacheKey.value] = undefined
    nuxtApp.static.data[cacheKey.value] = undefined
  }

  // --- Mutations (API call + optimistic update + cache invalidation) ---

  async function saveBody(newBody: string) {
    if (!issue.value || !repo.value) return
    const result = await apiFetch<{ id: string, body: string, bodyHTML: string, updatedAt: string }>('/api/issues/body', {
      method: 'PATCH',
      body: { id: issue.value.id, body: newBody, repo: repo.value, issueNumber: number.value },
    })
    issue.value = {
      ...issue.value,
      body: result.body,
      bodyHTML: result.bodyHTML,
      updatedAt: result.updatedAt,
    }
    invalidateCache()
    return result
  }

  async function submitComment(subjectId: string, body: string) {
    if (!repo.value) return
    const comment = await apiFetch<TimelineComment>('/api/issues/comments', {
      method: 'POST',
      body: { subjectId, body, repo: repo.value, issueNumber: number.value },
    })
    if (issue.value) {
      issue.value = {
        ...issue.value,
        timeline: [...issue.value.timeline, comment],
      }
    }
    invalidateCache()
    return comment
  }

  async function saveComment(id: string, body: string) {
    if (!repo.value) return
    const result = await apiFetch<{ id: string, body: string, bodyHTML: string, updatedAt: string }>('/api/issues/comments', {
      method: 'PATCH',
      body: { id, body, repo: repo.value, issueNumber: number.value },
    })
    if (issue.value) {
      issue.value = {
        ...issue.value,
        timeline: issue.value.timeline.map((item) => {
          if (item.type === 'IssueComment' && item.id === result.id) {
            return { ...item, ...result }
          }
          return item
        }),
      }
    }
    invalidateCache()
    return result
  }

  async function removeComment(id: string) {
    if (!repo.value) return
    await apiFetch('/api/issues/comments', {
      method: 'DELETE',
      body: { id, repo: repo.value, issueNumber: number.value },
    })
    if (issue.value) {
      issue.value = {
        ...issue.value,
        timeline: issue.value.timeline.filter(
          item => !(item.type === 'IssueComment' && item.id === id),
        ),
      }
    }
    invalidateCache()
  }

  // Editing lock: only one editor active at a time
  const editingId = useState<string | null>('issue-editing-id', () => null)

  // Scroll-preserving refresh
  async function smartRefresh() {
    const scrollY = window.scrollY
    await refresh()
    await nextTick()
    window.scrollTo(0, scrollY)
  }

  return {
    issue,
    status,
    error,
    refresh: smartRefresh,
    saveBody,
    submitComment,
    saveComment,
    removeComment,
    invalidateCache,
    editingId,
  }
}
