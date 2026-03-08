<script lang="ts" setup>
const props = defineProps<{
  owner: string
  repoName: string
  id: string
}>()

const workItemRef = inject<Ref<WorkItemDetail | null>>('workItemRef')!

const { t, locale } = useI18n()
const { loggedIn, user } = useUserSession()
const toast = useToast()

const repo = computed(() => `${props.owner}/${props.repoName}`)
const ownerRef = toRef(props, 'owner')
const repoNameRef = toRef(props, 'repoName')
const idRef = toRef(props, 'id')

// --- Issue detail (only for issue-primary) ---

const isIssuePrimary = computed(() => workItemRef.value?.primaryType === 'issue')
const issueNumber = computed(() => isIssuePrimary.value ? workItemRef.value?.number : undefined)

const { issue, submitComment } = useIssueDetail(repo, issueNumber)

const primarySubjectId = computed(() => {
  if (issue.value) return issue.value.id
  const entry = workItemRef.value?.timeline.find(e => e.isInitial && e.source === workItemRef.value?.primaryType)
  return entry?.subjectId
})

function usersMapToMentions(users: Map<string, string>): MentionUser[] {
  return Array.from(users.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, src]) => ({ label, avatar: src ? { src } : undefined }))
}

const mentionUsers = computed<MentionUser[]>(() => {
  const users = new Map<string, string>()

  if (issue.value) {
    users.set(issue.value.author.login, issue.value.author.avatarUrl)
    for (const assignee of issue.value.assignees) {
      users.set(assignee.login, assignee.avatarUrl)
    }
    for (const item of issue.value.timeline) {
      if (item.type === 'IssueComment') {
        users.set(item.author.login, item.author.avatarUrl)
      }
    }
  }
  else {
    for (const entry of workItemRef.value?.timeline ?? []) {
      if (entry.author && entry.authorAvatarUrl) {
        users.set(entry.author, entry.authorAvatarUrl)
      }
    }
  }

  return usersMapToMentions(users)
})

// --- Contributions ---

const contributions = computed(() => workItemRef.value?.contributions ?? [])

/** All numbers belonging to this work item (own + contributions) for self-ref badge detection */
const selfNumbers = computed<number[]>(() => {
  const wi = workItemRef.value
  if (!wi) return []
  const nums = [wi.number]
  for (const c of wi.contributions) nums.push(c.number)
  return nums
})

const pullSubjectIdsByNumber = computed<Record<number, string>>(() => {
  const result: Record<number, string> = {}
  for (const contribution of contributions.value) {
    if (contribution.subjectId) {
      result[contribution.number] = contribution.subjectId
    }
  }
  return result
})

// --- Timeline mapping ---

function timelineKindLabel(kind: string) {
  switch (kind) {
    case 'comment': return t('workItems.timeline.kind.comment')
    case 'review': return t('workItems.timeline.kind.review')
    case 'state': return t('workItems.timeline.kind.state')
    case 'assignment': return t('workItems.timeline.kind.assignment')
    case 'label': return t('workItems.timeline.kind.label')
    case 'cross-reference': return t('workItems.timeline.kind.crossReference')
    case 'milestone': return t('workItems.timeline.kind.milestone')
    case 'rename': return t('workItems.timeline.kind.rename')
    case 'reference': return t('workItems.timeline.kind.reference')
    default: return t('workItems.timeline.kind.event')
  }
}

type IssueNonCommentEvent = Exclude<TimelineItem, { type: 'IssueComment' }>

type WorkItemTimelineUiItem = {
  date?: string
  title?: string
  description?: string
  icon?: string
  ui?: Record<string, string>
} & {
  id: string
  subjectId?: string
  body?: string
  reactionGroups?: ReactionGroup[]
  reviewComments?: ReviewComment[]
  kind: WorkItemTimelineEntry['kind']
  isInitial?: boolean
  authorAvatarUrl?: string
  source: WorkItemTimelineEntry['source']
  sourceNumber: number
  action: string
  issueEvent?: IssueNonCommentEvent
  reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  viewerCanUpdate?: boolean
  viewerCanDelete?: boolean
  crossRefSource?: WorkItemTimelineEntry['crossRefSource']
  milestoneTitle?: string
  previousTitle?: string
  currentTitle?: string
  commitId?: string
  commitMessage?: string
}

function timelineIcon(entry: WorkItemTimelineEntry) {
  if (entry.kind === 'comment') return 'i-lucide-message-square'
  if (entry.kind === 'review') {
    if (entry.reviewState === 'APPROVED') return 'i-lucide-check-check'
    if (entry.reviewState === 'CHANGES_REQUESTED') return 'i-lucide-circle-alert'
    return 'i-lucide-message-square-more'
  }
  if (entry.kind === 'state') {
    if (entry.state === 'MERGED') return 'i-lucide-git-merge'
    if (entry.state === 'CLOSED') return 'i-lucide-circle-check'
    if (entry.state === 'REOPENED') return 'i-lucide-rotate-ccw'
    return 'i-lucide-circle-dot'
  }
  if (entry.kind === 'assignment') return 'i-lucide-user-plus'
  if (entry.kind === 'label') return 'i-lucide-tag'
  if (entry.kind === 'cross-reference') return 'i-lucide-arrow-up-right'
  if (entry.kind === 'milestone') return 'i-lucide-milestone'
  if (entry.kind === 'rename') return 'i-lucide-pencil'
  if (entry.kind === 'reference') return 'i-lucide-git-commit-horizontal'
  return 'i-lucide-history'
}

function timelineAction(entry: WorkItemTimelineEntry) {
  if (entry.isInitial) return t('workItems.timeline.action.opened')
  if (entry.kind === 'comment') return t('workItems.timeline.action.commented')
  if (entry.kind === 'review') {
    if (entry.reviewState === 'APPROVED') return t('workItems.timeline.action.approvedReview')
    if (entry.reviewState === 'CHANGES_REQUESTED') return t('workItems.timeline.action.requestedChanges')
    return t('workItems.timeline.action.reviewed')
  }
  if (entry.kind === 'state') {
    if (entry.state === 'MERGED') return t('workItems.timeline.action.merged')
    if (entry.state === 'CLOSED') return t('workItems.timeline.action.closed')
    if (entry.state === 'REOPENED') return t('workItems.timeline.action.reopened')
    return t('workItems.timeline.action.updatedState')
  }
  if (entry.kind === 'assignment') {
    if (entry.state === 'UNASSIGNED') return t('workItems.timeline.action.unassigned', { assignee: entry.assignee ?? '' }).trim()
    return t('workItems.timeline.action.assigned', { assignee: entry.assignee ?? '' }).trim()
  }
  if (entry.kind === 'label') {
    if (entry.state === 'UNLABELED') return t('workItems.timeline.action.removedLabel', { label: entry.labelName ?? '' }).trim()
    return t('workItems.timeline.action.addedLabel', { label: entry.labelName ?? '' }).trim()
  }
  return timelineKindLabel(entry.kind)
}

function timelineDescription(entry: WorkItemTimelineEntry): string | undefined {
  if (entry.kind === 'comment' || entry.kind === 'review') {
    if (entry.body) return entry.body
    if (entry.kind === 'review' && entry.reviewState) {
      return t('workItems.timeline.reviewState', { state: entry.reviewState })
    }
  }
  return undefined
}

function toIssueEvent(entry: WorkItemTimelineEntry): IssueNonCommentEvent | null {
  if (entry.kind === 'label' && entry.labelName) {
    const label = { name: entry.labelName, color: '6b7280' }
    if (entry.state === 'UNLABELED') {
      return { type: 'UnlabeledEvent', actor: entry.author, createdAt: entry.createdAt, label }
    }
    return { type: 'LabeledEvent', actor: entry.author, createdAt: entry.createdAt, label }
  }
  if (entry.kind === 'assignment' && entry.assignee) {
    if (entry.state === 'UNASSIGNED') {
      return { type: 'UnassignedEvent', actor: entry.author, createdAt: entry.createdAt, assignee: entry.assignee }
    }
    return { type: 'AssignedEvent', actor: entry.author, createdAt: entry.createdAt, assignee: entry.assignee }
  }
  if (entry.kind === 'state') {
    if (entry.state === 'REOPENED') {
      return { type: 'ReopenedEvent', actor: entry.author, createdAt: entry.createdAt }
    }
    if (entry.state === 'CLOSED') {
      return { type: 'ClosedEvent', actor: entry.author, createdAt: entry.createdAt, stateReason: 'COMPLETED' }
    }
  }
  if (entry.kind === 'cross-reference' && entry.crossRefSource) {
    return { type: 'CrossReferencedEvent', actor: entry.author, createdAt: entry.createdAt, source: entry.crossRefSource }
  }
  if (entry.kind === 'milestone' && entry.milestoneTitle) {
    return { type: 'MilestonedEvent', actor: entry.author, createdAt: entry.createdAt, milestoneTitle: entry.milestoneTitle }
  }
  if (entry.kind === 'rename' && entry.previousTitle && entry.currentTitle) {
    return { type: 'RenamedTitleEvent', actor: entry.author, createdAt: entry.createdAt, previousTitle: entry.previousTitle, currentTitle: entry.currentTitle }
  }
  if (entry.kind === 'reference' && entry.commitId && entry.commitMessage) {
    return { type: 'ReferencedEvent', actor: entry.author, createdAt: entry.createdAt, commitId: entry.commitId, commitMessage: entry.commitMessage }
  }
  return null
}

const timelineItems = computed<WorkItemTimelineUiItem[]>(() => {
  return (workItemRef.value?.timeline ?? []).map(entry => ({
    id: entry.id,
    subjectId: entry.subjectId,
    date: entry.createdAt,
    title: entry.author,
    description: timelineDescription(entry),
    body: entry.body,
    reactionGroups: entry.reactionGroups,
    reviewComments: entry.reviewComments,
    kind: entry.kind,
    isInitial: entry.isInitial,
    authorAvatarUrl: entry.authorAvatarUrl,
    icon: timelineIcon(entry),
    source: entry.source,
    sourceNumber: entry.sourceNumber,
    action: timelineAction(entry),
    reviewState: entry.reviewState as WorkItemTimelineUiItem['reviewState'],
    issueEvent: toIssueEvent(entry) ?? undefined,
    viewerCanUpdate: entry.viewerCanUpdate,
    viewerCanDelete: entry.viewerCanDelete,
    crossRefSource: entry.crossRefSource,
    milestoneTitle: entry.milestoneTitle,
    previousTitle: entry.previousTitle,
    currentTitle: entry.currentTitle,
    commitId: entry.commitId,
    commitMessage: entry.commitMessage,
    ui: entry.source === 'pull' ? { item: 'flex-row-reverse' } : undefined,
  }))
})

// --- Timeline rail ---

type TimelineRailEntry = {
  key: string
  targetId: string
  targetIds: string[]
  icon: string
  count: number
  top: number
  tooltip: string
  source: WorkItemTimelineEntry['source']
}

const activeRailTargetId = ref<string | null>(null)
const flashTimelineTargetId = ref<string | null>(null)

let timelineObserver: IntersectionObserver | null = null
let flashTimeout: ReturnType<typeof setTimeout> | null = null
const visibleTimelineEntries = new Map<string, number>()

function timelineDomId(id: string) {
  return `work-item-timeline-${id}`
}

function formatTimelineDate(date: string | undefined) {
  if (!date) return ''
  return new Intl.DateTimeFormat(locale.value || undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}

function railTooltip(bucket: WorkItemTimelineUiItem[], anchorItem: WorkItemTimelineUiItem) {
  const eventCount = bucket.length === 1
    ? t('workItems.timeline.eventCount.one')
    : t('workItems.timeline.eventCount.other', { count: bucket.length })
  const sourceLabel = anchorItem.source === 'pull'
    ? t('workItems.timeline.source.pull', { number: anchorItem.sourceNumber })
    : t('workItems.timeline.source.issue')
  const actorAction = `${anchorItem.title ?? t('repos.reason.unknown')} ${anchorItem.action}`.trim()
  const kindLabels = [...new Set(bucket.map(item => timelineKindLabel(item.kind)))]
  const kindSummary = kindLabels.length <= 2
    ? kindLabels.join(', ')
    : `${kindLabels.slice(0, 2).join(', ')} +${kindLabels.length - 2}`
  const dateLabel = formatTimelineDate(anchorItem.date as string | undefined)
  return [eventCount, sourceLabel, actorAction, kindSummary, dateLabel].filter(Boolean).join(' \u2022 ')
}

function railAriaLabel(entry: TimelineRailEntry) {
  return t('workItems.timeline.scrollToItem', { target: entry.tooltip || entry.targetId })
}

function flashTimelineEntry(targetId: string) {
  flashTimelineTargetId.value = targetId
  if (flashTimeout) clearTimeout(flashTimeout)
  flashTimeout = setTimeout(() => {
    if (flashTimelineTargetId.value === targetId) flashTimelineTargetId.value = null
  }, 1400)
}

function scrollToTimelineItem(targetId: string) {
  if (!import.meta.client) return
  const element = document.getElementById(targetId)
  if (!element) return
  activeRailTargetId.value = targetId
  flashTimelineEntry(targetId)
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function refreshActiveRailFromVisibleEntries() {
  if (!visibleTimelineEntries.size) return
  let closestId: string | null = null
  let minDistance = Number.POSITIVE_INFINITY
  for (const [entryId, distance] of visibleTimelineEntries.entries()) {
    if (distance < minDistance) {
      minDistance = distance
      closestId = entryId
    }
  }
  if (closestId) activeRailTargetId.value = closestId
}

function setupTimelineObserver() {
  if (!import.meta.client) return
  timelineObserver?.disconnect()
  timelineObserver = null
  visibleTimelineEntries.clear()

  timelineObserver = new IntersectionObserver((entries) => {
    const viewportCenter = window.innerHeight / 2
    for (const entry of entries) {
      const elId = (entry.target as HTMLElement).id
      if (!elId) continue
      if (entry.isIntersecting) {
        const rect = entry.boundingClientRect
        const center = rect.top + rect.height / 2
        visibleTimelineEntries.set(elId, Math.abs(center - viewportCenter))
      }
      else {
        visibleTimelineEntries.delete(elId)
      }
    }
    refreshActiveRailFromVisibleEntries()
  }, {
    threshold: [0, 0.25, 0.5, 0.75, 1],
    rootMargin: '-30% 0px -30% 0px',
  })

  for (const item of timelineItems.value) {
    const element = document.getElementById(timelineDomId(item.id))
    if (element) timelineObserver.observe(element)
  }
}

const timelineRailEntries = computed<TimelineRailEntry[]>(() => {
  const items = timelineItems.value
  if (!items.length) return []

  const markerSlots = Math.min(24, items.length)
  const bins: WorkItemTimelineUiItem[][] = Array.from({ length: markerSlots }, () => [])

  for (const [index, item] of items.entries()) {
    const slotIndex = markerSlots === 1
      ? 0
      : Math.round((index / (items.length - 1)) * (markerSlots - 1))
    bins[slotIndex]!.push(item)
  }

  return bins
    .map((bucket, bucketIndex) => {
      if (!bucket.length) return null
      const iconSet = new Set(bucket.map(item => item.icon))
      const anchorItem = bucket[Math.floor(bucket.length / 2)]!
      const targetIds = bucket.map(item => timelineDomId(item.id))
      return {
        key: `${bucketIndex}-${anchorItem.id}`,
        targetId: timelineDomId(anchorItem.id),
        targetIds,
        icon: iconSet.size > 1 ? 'i-lucide-layers-3' : (anchorItem.icon ?? 'i-lucide-history'),
        count: bucket.length,
        top: markerSlots === 1 ? 50 : (bucketIndex / (markerSlots - 1)) * 100,
        tooltip: railTooltip(bucket, anchorItem),
        source: anchorItem.source,
      }
    })
    .filter((entry): entry is TimelineRailEntry => entry !== null)
})

watch(timelineItems, async () => {
  if (!import.meta.client) return
  await nextTick()
  setupTimelineObserver()
}, { immediate: true })

onBeforeUnmount(() => {
  timelineObserver?.disconnect()
  timelineObserver = null
  if (flashTimeout) {
    clearTimeout(flashTimeout)
    flashTimeout = null
  }
})

// --- Replies ---

const replyingToCommentId = ref<string | null>(null)
const replyBody = ref('')
const replySubmitting = ref(false)
const timelineLocalReplies = ref<Record<string, ReviewComment[]>>({})

function startReply(commentId: string) {
  replyingToCommentId.value = commentId
  replyBody.value = ''
}

function getLocalReplies(commentId: string, serverReplies?: ReviewComment[]): ReviewComment[] {
  const optimistic = timelineLocalReplies.value[commentId] ?? []
  const server = serverReplies ?? []
  const serverIds = new Set(server.map(r => r.id))
  return [...server, ...optimistic.filter(r => !serverIds.has(r.id))]
}

async function submitReply(reviewComment: ReviewComment, pullNumber: number) {
  if (!replyBody.value.trim() || replySubmitting.value || !reviewComment.databaseId) return

  replySubmitting.value = true
  try {
    const result = await $fetch<ReviewComment>('/api/pull-requests/review-comments', {
      method: 'POST',
      body: {
        commentId: reviewComment.databaseId,
        body: replyBody.value,
        owner: props.owner,
        repo: props.repoName,
        pullNumber,
        workItemId: props.id,
      },
    })

    const existing = timelineLocalReplies.value[reviewComment.id] ?? []
    timelineLocalReplies.value = {
      ...timelineLocalReplies.value,
      [reviewComment.id]: [...existing, {
        id: result.id,
        databaseId: result.databaseId,
        body: result.body,
        path: result.path,
        line: result.line,
        author: result.author,
        authorAvatarUrl: result.authorAvatarUrl,
        createdAt: result.createdAt,
      }],
    }

    replyBody.value = ''
    replyingToCommentId.value = null
  }
  catch {
    toast.add({ title: t('workItems.timeline.replyError'), color: 'error' })
  }
  finally {
    replySubmitting.value = false
  }
}

// --- Review comments expand/collapse ---

const expandedReviewComments = ref<Record<string, boolean>>({})

function isReviewCommentsExpanded(item: WorkItemTimelineUiItem) {
  const count = item.reviewComments?.length ?? 0
  if (count === 0) return false
  return expandedReviewComments.value[item.id] ?? count <= 3
}

function toggleReviewComments(item: WorkItemTimelineUiItem) {
  expandedReviewComments.value = {
    ...expandedReviewComments.value,
    [item.id]: !isReviewCommentsExpanded(item),
  }
}

// --- Reactions ---

const timelineLocalReactions = ref<Record<string, ReactionGroup[]>>({})

watch(timelineItems, (items) => {
  const next: Record<string, ReactionGroup[]> = {}
  for (const item of items) {
    next[item.id] = item.reactionGroups?.length ? [...item.reactionGroups] : (timelineLocalReactions.value[item.id] ?? [])
    for (const rc of item.reviewComments ?? []) {
      next[rc.id] = rc.reactionGroups?.length ? [...rc.reactionGroups] : (timelineLocalReactions.value[rc.id] ?? [])
      for (const reply of getLocalReplies(rc.id, rc.replies)) {
        next[reply.id] = reply.reactionGroups?.length ? [...reply.reactionGroups] : (timelineLocalReactions.value[reply.id] ?? [])
      }
    }
  }
  timelineLocalReactions.value = next
}, { immediate: true })

function getLocalReactions(id: string) {
  return timelineLocalReactions.value[id] ?? []
}

function onReactionToggle(id: string, content: string, added: boolean) {
  const reactions = [...getLocalReactions(id)]
  const index = reactions.findIndex(r => r.content === content)

  if (added && index === -1) {
    reactions.push({ content, count: 1, viewerHasReacted: true })
  }
  else if (added && index >= 0) {
    reactions[index] = { ...reactions[index]!, count: reactions[index]!.count + 1, viewerHasReacted: true }
  }
  else if (!added && index >= 0) {
    const current = reactions[index]!
    if (current.count <= 1) reactions.splice(index, 1)
    else reactions[index] = { ...current, count: current.count - 1, viewerHasReacted: false }
  }

  timelineLocalReactions.value = { ...timelineLocalReactions.value, [id]: reactions }
}

// --- Subject ID resolution ---

function getTimelineSubjectId(item: WorkItemTimelineUiItem): string | undefined {
  if (item.subjectId) return item.subjectId
  if (item.isInitial && item.source === 'issue') return issue.value?.id
  if (item.isInitial && item.source === 'pull') return pullSubjectIdsByNumber.value[item.sourceNumber]
  return undefined
}

// --- Edit/Delete ---

const {
  editingId: editingTimelineId,
  startEdit: startTimelineEdit,
  cancelEdit,
  saveComment: saveTimelineComment,
  deleteComment: deleteTimelineComment,
  saveReviewComment,
  deleteReviewComment,
} = useWorkItemMutations({ workItem: workItemRef, owner: ownerRef, repoName: repoNameRef, repo, id: idRef })

function handleStartEdit(item: WorkItemTimelineUiItem) {
  startTimelineEdit(item.id)
}

function handleSaveEdit(item: WorkItemTimelineUiItem, body: string) {
  const subjectId = getTimelineSubjectId(item)
  if (!subjectId) return
  saveTimelineComment(item.id, subjectId, body, {
    isInitial: item.isInitial,
    source: item.source,
    sourceNumber: item.sourceNumber,
  })
}

function handleTaskToggle(item: WorkItemTimelineUiItem, { taskIndex }: TaskToggleDetail) {
  if (!item.body) return
  const toggledBody = toggleTaskInMarkdown(item.body, taskIndex)
  handleSaveEdit(item, toggledBody)
}

function handleDelete(item: WorkItemTimelineUiItem) {
  const subjectId = getTimelineSubjectId(item)
  if (!subjectId) return
  deleteTimelineComment(item.id, subjectId, { sourceNumber: item.sourceNumber })
}

// --- Comment form ---
const commentFormRef = ref<{ active: boolean }>()
</script>

<template>
  <div
    class="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-6 2xl:grid-cols-[44px_minmax(0,1fr)_260px]"
  >
    <div
      v-if="timelineRailEntries.length"
      class="hidden 2xl:flex"
    >
      <div class="sticky top-44 h-[72vh] w-10">
        <div class="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />

        <UTooltip
          v-for="entry in timelineRailEntries"
          :key="entry.key"
          :text="entry.tooltip"
        >
          <button
            type="button"
            class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full border transition-colors"
            :class="[
              entry.targetIds.includes(activeRailTargetId ?? '')
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-default bg-default text-muted hover:text-highlighted hover:border-primary/40',
              entry.source === 'pull' ? 'ring-1 ring-primary/20' : '',
            ]"
            :style="{ top: `${entry.top}%` }"
            :aria-label="railAriaLabel(entry)"
            @click="scrollToTimelineItem(entry.targetId)"
          >
            <UIcon
              :name="entry.icon"
              class="size-3"
            />

            <span
              v-if="entry.count > 1"
              class="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-elevated px-1 text-[10px] leading-none text-muted"
            >
              {{ entry.count }}
            </span>
          </button>
        </UTooltip>
      </div>
    </div>

    <div class="flex flex-col gap-4 min-w-0">
      <div
        v-if="workItemRef?.timeline.length"
        class="space-y-4"
      >
        <UTimeline
          :items="timelineItems"
          size="xs"
          :ui="{
            root: 'gap-0',
            separator: 'h-full',
            description: 'mt-2 text-default',
            item: 'py-0',
            container: 'gap-0',
            date: 'hidden',
            wrapper: 'gap-2',
          }"
        >
          <template #indicator="{ item }">
            <UAvatar
              v-if="(item.kind === 'comment' || item.kind === 'review') && item.authorAvatarUrl"
              :src="item.authorAvatarUrl"
              :alt="item.title"
              size="2xs"
            />
            <UIcon
              v-else
              :name="item.icon"
              class="size-3.5"
            />
          </template>

          <template #title="{ item }">
            <div
              :id="timelineDomId(item.id)"
              class="relative rounded-md px-1 py-0.5 transition-colors duration-700 w-fit"
              :class="[
                item.source === 'pull' ? 'justify-self-end' : '',
                flashTimelineTargetId === timelineDomId(item.id) ? 'bg-primary/10 ring-1 ring-primary/40' : '',
              ]"
            >
              <span
                v-if="getTimelineSubjectId(item) && (item.kind === 'comment' || item.kind === 'review')"
                :id="'comment-' + getTimelineSubjectId(item)"
                class="absolute"
              />
              <template v-if="item.kind === 'comment' || item.kind === 'review'" />

              <div
                v-else-if="item.issueEvent"
                class="flex gap-1"
              >
                <IssueEventGroup
                  :class="item.source === 'pull' ? 'flex justify-end' : ''"
                  :events="[item.issueEvent]"
                  :show-time="false"
                  compact
                />
              </div>

              <div
                v-else
                class="flex gap-1"
              >
                <span>{{ item.title }}</span>
                <UBadge
                  v-if="item.title && isBotAuthor(item.title)"
                  size="xs"
                  color="neutral"
                  variant="soft"
                >
                  {{ t('workItems.badge.bot') }}
                </UBadge>
                <span class="font-normal text-muted">{{ item.action }}</span>
                <span class="text-dimmed text-xs/5">{{ timeAgo(item.date as string) }}</span>
              </div>
            </div>
          </template>

          <template #description="{ item }">
            <TimelineCommentCard
              v-if="item.kind === 'comment' || item.kind === 'review'"
              :author="item.title ?? ''"
              :author-avatar-url="item.authorAvatarUrl"
              :action="item.action"
              :created-at="(item.date as string)"
              :body="item.body"
              :fallback-description="item.description"
              :is-bot="item.title ? isBotAuthor(item.title) : false"
              :is-own-comment="item.title === user?.login"
              :is-initial="item.isInitial"
              :review-state="item.kind === 'review' ? item.reviewState : undefined"
              :source="item.source"
              :repo-context="repo"
              :self-numbers="selfNumbers"
              :reactions="getLocalReactions(item.id)"
              :subject-id="getTimelineSubjectId(item)"
              :issue-number="workItemRef?.number"
              :work-item-id="id"
              :viewer-can-update="item.viewerCanUpdate"
              :viewer-can-delete="item.viewerCanDelete"
              :is-editing="editingTimelineId === item.id"
              :viewer-can-toggle-tasks="item.viewerCanUpdate && item.isInitial"
              :edit-disabled="editingTimelineId !== null && editingTimelineId !== item.id"
              @task-toggle="(detail) => handleTaskToggle(item, detail)"
              @reaction-toggle="(content, added) => onReactionToggle(item.id, content, added)"
              @start-edit="handleStartEdit(item)"
              @cancel-edit="cancelEdit"
              @save-edit="(body) => handleSaveEdit(item, body)"
              @delete="handleDelete(item)"
            >
              <template #review-comments>
                <div
                  v-if="item.reviewComments?.length"
                  class="px-3 pb-2"
                >
                  <div class="border-t border-default pt-2">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 text-sm text-muted hover:text-highlighted transition-colors"
                      :aria-expanded="isReviewCommentsExpanded(item)"
                      :aria-controls="`review-comments-${item.id}`"
                      @click="toggleReviewComments(item)"
                    >
                      <UIcon
                        :name="isReviewCommentsExpanded(item) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                        class="size-4"
                      />
                      <span>{{ t('workItems.timeline.reviewComment', item.reviewComments.length) }}</span>
                    </button>

                    <div
                      v-if="isReviewCommentsExpanded(item)"
                      :id="`review-comments-${item.id}`"
                      class="mt-2 space-y-3"
                    >
                      <TimelineReviewCommentThread
                        v-for="rc in item.reviewComments"
                        :key="rc.id"
                        :comment="rc"
                        :replies="getLocalReplies(rc.id, rc.replies)"
                        :repo-context="repo"
                        :issue-number="workItemRef?.number"
                        :self-numbers="selfNumbers"
                        :work-item-id="id"
                        :current-user-login="user?.login"
                        :reactions="getLocalReactions(rc.id)"
                        :reply-reactions="Object.fromEntries(getLocalReplies(rc.id, rc.replies).map(r => [r.id, getLocalReactions(r.id)]))"
                        :is-replying="replyingToCommentId === rc.id"
                        :reply-body="replyBody"
                        :reply-submitting="replySubmitting"
                        @reaction-toggle="(content, added) => onReactionToggle(rc.id, content, added)"
                        @reply-reaction-toggle="(replyId, content, added) => onReactionToggle(replyId, content, added)"
                        @start-reply="startReply(rc.id)"
                        @cancel-reply="replyingToCommentId = null"
                        @update:reply-body="replyBody = $event"
                        @submit-reply="submitReply(rc, item.sourceNumber)"
                        @edit-comment="(cId, dbId, body) => saveReviewComment(item.id, cId, dbId, body)"
                        @delete-comment="(cId, dbId) => deleteReviewComment(item.id, cId, dbId)"
                        @edit-reply="(cId, dbId, body) => saveReviewComment(item.id, cId, dbId, body)"
                        @delete-reply="(cId, dbId) => deleteReviewComment(item.id, cId, dbId)"
                      />
                    </div>
                  </div>
                </div>
              </template>
            </TimelineCommentCard>
          </template>
        </UTimeline>
      </div>

      <div
        v-if="loggedIn && primarySubjectId"
        :class="commentFormRef?.active ? 'sticky bottom-0 z-10' : ''"
      >
        <IssueCommentForm
          ref="commentFormRef"
          :issue-id="primarySubjectId"
          :repo-context="repo"
          :mention-users="mentionUsers"
          :submit-comment="submitComment"
          @submitted="toast.add({ title: t('issues.comment.submitted'), color: 'success' })"
        />
      </div>
    </div>

    <div
      v-if="workItemRef"
      class="hidden lg:block"
    >
      <div class="sticky top-48">
        <WorkItemSidebar
          :work-item="workItemRef"
          :repo="repo"
        />
      </div>
    </div>
  </div>
</template>
