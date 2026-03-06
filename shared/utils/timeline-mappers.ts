import type { WorkItemTimelineEntry } from '../types/work-item'

export function editCommentBody(timeline: WorkItemTimelineEntry[], entryId: string, newBody: string): WorkItemTimelineEntry[] {
  return timeline.map(e => e.id === entryId ? { ...e, body: newBody } : e)
}

export function removeComment(timeline: WorkItemTimelineEntry[], entryId: string): WorkItemTimelineEntry[] {
  return timeline.filter(e => e.id !== entryId)
}

export function editReviewComment(timeline: WorkItemTimelineEntry[], entryId: string, commentId: string, newBody: string): WorkItemTimelineEntry[] {
  return timeline.map((e) => {
    if (e.id !== entryId) return e
    return {
      ...e,
      reviewComments: e.reviewComments?.map((rc) => {
        if (rc.id === commentId) return { ...rc, body: newBody }
        if (rc.replies?.some(r => r.id === commentId)) {
          return { ...rc, replies: rc.replies.map(r => r.id === commentId ? { ...r, body: newBody } : r) }
        }
        return rc
      }),
    }
  })
}

export function removeReviewComment(timeline: WorkItemTimelineEntry[], entryId: string, commentId: string): WorkItemTimelineEntry[] {
  return timeline.map((e) => {
    if (e.id !== entryId) return e
    return {
      ...e,
      reviewComments: e.reviewComments
        ?.filter(rc => rc.id !== commentId)
        .map(rc => ({
          ...rc,
          replies: rc.replies?.filter(r => r.id !== commentId),
        })),
    }
  })
}
