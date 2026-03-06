import type { WorkItemDetail, WorkItemTimelineEntry } from '~~/shared/types/work-item'
import { editCommentBody, editReviewComment, removeComment, removeReviewComment } from '~~/shared/utils/timeline-mappers'

interface WorkItemMutationContext {
  workItem: Ref<WorkItemDetail | null | undefined>
  owner: Ref<string>
  repoName: Ref<string>
  repo: Ref<string>
  id: Ref<string>
}

export function useWorkItemMutations(ctx: WorkItemMutationContext) {
  const { t } = useI18n()
  const toast = useToast()
  const nuxtApp = useNuxtApp()

  const editingId = useState<string | null>('work-item-editing-id', () => null)

  watch(ctx.id, () => {
    editingId.value = null
  })

  function invalidateCache() {
    const key = `work-item-detail-${ctx.owner.value}-${ctx.repoName.value}-${ctx.id.value}`
    nuxtApp.payload.data[key] = undefined
    nuxtApp.static.data[key] = undefined
  }

  function updateTimeline(mapper: (timeline: WorkItemTimelineEntry[]) => WorkItemTimelineEntry[]) {
    if (!ctx.workItem.value) return
    ctx.workItem.value = {
      ...ctx.workItem.value,
      timeline: mapper(ctx.workItem.value.timeline),
    }
    invalidateCache()
  }

  function startEdit(entryId: string) {
    editingId.value = entryId
  }

  function cancelEdit() {
    editingId.value = null
  }

  async function saveComment(
    entryId: string,
    subjectId: string,
    body: string,
    opts: { isInitial?: boolean, source: 'issue' | 'pull', sourceNumber: number },
  ) {
    const normalizedBody = normalizeMarkdownMentions(body)

    try {
      if (opts.isInitial) {
        await $fetch('/api/issues/body', {
          method: 'PATCH',
          body: {
            id: subjectId,
            body: normalizedBody,
            repo: ctx.repo.value,
            issueNumber: opts.sourceNumber,
            type: opts.source === 'pull' ? 'pull' : 'issue',
            workItemId: ctx.id.value,
          },
        })
      }
      else {
        await $fetch('/api/issues/comments', {
          method: 'PATCH',
          body: {
            id: subjectId,
            body: normalizedBody,
            repo: ctx.repo.value,
            issueNumber: opts.sourceNumber,
            workItemId: ctx.id.value,
          },
        })
      }

      updateTimeline(timeline => editCommentBody(timeline, entryId, normalizedBody))

      editingId.value = null
      toast.add({ title: t('workItems.timeline.commentUpdated'), color: 'success' })
    }
    catch {
      toast.add({ title: t('workItems.timeline.editError'), color: 'error' })
    }
  }

  async function deleteComment(
    entryId: string,
    subjectId: string,
    opts: { sourceNumber: number },
  ) {
    try {
      await $fetch('/api/issues/comments', {
        method: 'DELETE',
        body: {
          id: subjectId,
          repo: ctx.repo.value,
          issueNumber: opts.sourceNumber,
          workItemId: ctx.id.value,
        },
      })

      updateTimeline(timeline => removeComment(timeline, entryId))
      toast.add({ title: t('workItems.timeline.commentDeleted'), color: 'success' })
    }
    catch {
      toast.add({ title: t('workItems.timeline.deleteError'), color: 'error' })
    }
  }

  async function saveReviewComment(entryId: string, commentId: string, databaseId: number, body: string) {
    const normalizedBody = normalizeMarkdownMentions(body)

    try {
      await $fetch('/api/pull-requests/review-comments', {
        method: 'PATCH',
        body: {
          commentId: databaseId,
          body: normalizedBody,
          owner: ctx.owner.value,
          repo: ctx.repoName.value,
          workItemId: ctx.id.value,
        },
      })

      updateTimeline(timeline => editReviewComment(timeline, entryId, commentId, normalizedBody))

      toast.add({ title: t('workItems.timeline.commentUpdated'), color: 'success' })
    }
    catch {
      toast.add({ title: t('workItems.timeline.editError'), color: 'error' })
    }
  }

  async function deleteReviewComment(entryId: string, commentId: string, databaseId: number) {
    try {
      await $fetch('/api/pull-requests/review-comments', {
        method: 'DELETE',
        body: {
          commentId: databaseId,
          owner: ctx.owner.value,
          repo: ctx.repoName.value,
          workItemId: ctx.id.value,
        },
      })

      updateTimeline(timeline => removeReviewComment(timeline, entryId, commentId))

      toast.add({ title: t('workItems.timeline.commentDeleted'), color: 'success' })
    }
    catch {
      toast.add({ title: t('workItems.timeline.deleteError'), color: 'error' })
    }
  }

  return {
    editingId: readonly(editingId),
    startEdit,
    cancelEdit,
    saveComment,
    deleteComment,
    saveReviewComment,
    deleteReviewComment,
  }
}
