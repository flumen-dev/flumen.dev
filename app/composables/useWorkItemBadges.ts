import type { WorkItem } from '~~/shared/types/work-item'

const STATE_COLOR: Record<string, string> = {
  OPEN: 'success',
  CLOSED: 'neutral',
  MERGED: 'primary',
  DRAFT: 'neutral',
}

export function useWorkItemBadges() {
  const { t } = useI18n()

  function stateBadgeColor(itemState: string) {
    return STATE_COLOR[itemState] ?? 'neutral'
  }

  function stateBadgeLabel(item: WorkItem) {
    if (item.type === 'pull' && item.isDraft) return t('repos.workItem.state.draft')
    if (item.state === 'MERGED') return t('repos.workItem.state.merged')
    if (item.state === 'CLOSED') return t('repos.workItem.state.closed')
    return t('repos.workItem.state.open')
  }

  function prStatusLabel(item: WorkItem) {
    if (item.type === 'pull') {
      if (item.isDraft) return t('repos.workItem.status.draft')
      if (item.state === 'MERGED') return t('repos.workItem.status.merged')
      if (item.reviewDecision === 'APPROVED') return t('repos.workItem.status.approved')
      if (item.reviewDecision === 'CHANGES_REQUESTED') return t('repos.workItem.status.changesRequested')
      if (item.reviewDecision === 'REVIEW_REQUIRED') return t('repos.workItem.status.reviewRequested')
      if (item.state === 'CLOSED') return t('repos.workItem.status.closed')
      return t('repos.workItem.status.open')
    }

    if (!item.linkedPulls.length) return null
    if (item.reviewDecision === 'APPROVED') return t('repos.workItem.status.prApproved')
    if (item.reviewDecision === 'CHANGES_REQUESTED') return t('repos.workItem.status.prChangesRequested')
    if (item.reviewDecision === 'REVIEW_REQUIRED') return t('repos.workItem.status.prReviewRequested')
    return t('repos.workItem.status.prLinked')
  }

  function ciIcon(ciStatus: WorkItem['ciStatus']) {
    return getCIIcon(ciStatus)
  }

  return { stateBadgeColor, stateBadgeLabel, prStatusLabel, ciIcon }
}
