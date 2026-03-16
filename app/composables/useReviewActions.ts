import type { Reviewer } from '~~/shared/types/work-item'

type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

interface ReviewResponse {
  id: string
  state: string
  body: string
  submittedAt: string
  author: string
  authorAvatarUrl: string
}

interface DismissResponse {
  id: string
  state: string
}

export function useReviewActions(
  owner: Ref<string>,
  repo: Ref<string>,
  prNumber: Ref<number | null>,
) {
  const submitting = ref(false)
  const error = ref<string | null>(null)

  async function submitReview(event: ReviewEvent, body?: string, workItemId?: string): Promise<ReviewResponse | null> {
    if (!prNumber.value) return null
    submitting.value = true
    error.value = null
    try {
      return await $fetch<ReviewResponse>(
        `/api/repository/${owner.value}/${repo.value}/pulls/${prNumber.value}/reviews`,
        { method: 'POST', body: { event, body, workItemId } },
      )
    }
    catch (e: unknown) {
      const fetchErr = e as { data?: { data?: { errorKey?: string, message?: string } }, message?: string }
      error.value = fetchErr.data?.data?.message ?? fetchErr.data?.data?.errorKey ?? fetchErr.message ?? 'unknown'
      return null
    }
    finally {
      submitting.value = false
    }
  }

  async function dismissReview(reviewId: number, message: string, workItemId?: string): Promise<DismissResponse | null> {
    if (!prNumber.value) return null
    submitting.value = true
    error.value = null
    try {
      return await $fetch<DismissResponse>(
        `/api/repository/${owner.value}/${repo.value}/pulls/${prNumber.value}/reviews/${reviewId}/dismiss`,
        { method: 'POST', body: { message, workItemId } },
      )
    }
    catch (e: unknown) {
      const fetchErr = e as { data?: { data?: { errorKey?: string, message?: string } }, message?: string }
      error.value = fetchErr.data?.data?.message ?? fetchErr.data?.data?.errorKey ?? fetchErr.message ?? 'unknown'
      return null
    }
    finally {
      submitting.value = false
    }
  }

  function getReviewerColor(state: Reviewer['state']): string {
    switch (state) {
      case 'APPROVED': return 'text-emerald-500'
      case 'CHANGES_REQUESTED': return 'text-red-500'
      case 'COMMENTED': return 'text-blue-500'
      case 'DISMISSED': return 'text-muted'
      case 'PENDING': return 'text-amber-500'
      default: return 'text-muted'
    }
  }

  function getReviewerIcon(state: Reviewer['state']): string {
    switch (state) {
      case 'APPROVED': return 'i-lucide-check'
      case 'CHANGES_REQUESTED': return 'i-lucide-file-diff'
      case 'COMMENTED': return 'i-lucide-message-square'
      case 'DISMISSED': return 'i-lucide-x'
      case 'PENDING': return 'i-lucide-clock'
      default: return 'i-lucide-circle'
    }
  }

  return { submitting, error, submitReview, dismissReview, getReviewerColor, getReviewerIcon }
}
