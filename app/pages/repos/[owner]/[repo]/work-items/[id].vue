<script lang="ts" setup>
import type { TimelineItem as NuxtTimelineItem } from '@nuxt/ui'
import type { TimelineItem as IssueTimelineItem } from '~~/shared/types/issue-detail'
import type { WorkItemDetail, WorkItemTimelineEntry } from '~~/shared/types/work-item'

definePageMeta({
  middleware: 'auth',
  titleKey: 'repos.detail.workItems',
})

const route = useRoute()
const hasTeleportContent = useState('has-page-title-teleport', () => true)

onMounted(() => {
  hasTeleportContent.value = true
})

onUnmounted(() => {
  hasTeleportContent.value = false
})

const owner = computed(() => route.params.owner as string)
const repoName = computed(() => route.params.repo as string)
const id = computed(() => route.params.id as string)
const repo = computed(() => `${owner.value}/${repoName.value}`)
const requestFetch = useRequestFetch()

const { data: workItem, status: workItemStatus, error: workItemError, refresh: refreshWorkItem } = await useAsyncData(
  () => `work-item-detail-${owner.value}-${repoName.value}-${id.value}`,
  () => requestFetch<WorkItemDetail>(`/api/repository/${owner.value}/${repoName.value}/work-items/${id.value}`),
  {
    watch: [owner, repoName, id],
  },
)

function delayedRefreshWorkItem() {
  globalThis.setTimeout(() => refreshWorkItem(), 10_000)
}

const number = computed(() => {
  if (workItem.value?.number) return workItem.value.number

  const parsed = Number.parseInt(id.value.replace(/^pr-/, ''), 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
})

const isIssuePrimary = computed(() => workItem.value?.primaryType === 'issue')

const issueNumber = computed(() => isIssuePrimary.value ? number.value : undefined)

const {
  issue,
  submitComment,
} = useIssueDetail(repo, issueNumber)

const primarySubjectId = computed(() => {
  if (issue.value) return issue.value.id
  const entry = workItem.value?.timeline.find(e => e.isInitial && e.source === workItem.value?.primaryType)
  return entry?.subjectId
})

const mentionUsers = computed<MentionUser[]>(() => {
  if (issue.value) {
    const users = new Map<string, string>()
    users.set(issue.value.author.login, issue.value.author.avatarUrl)

    for (const assignee of issue.value.assignees) {
      users.set(assignee.login, assignee.avatarUrl)
    }

    for (const item of issue.value.timeline) {
      if (item.type === 'IssueComment') {
        users.set(item.author.login, item.author.avatarUrl)
      }
    }

    return Array.from(users.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, src]) => ({
        label,
        avatar: src ? { src } : undefined,
      }))
  }

  // Fallback: derive from work item timeline (PR case)
  const users = new Map<string, string>()
  for (const entry of workItem.value?.timeline ?? []) {
    if (entry.author && entry.authorAvatarUrl) {
      users.set(entry.author, entry.authorAvatarUrl)
    }
  }

  return Array.from(users.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, src]) => ({
      label,
      avatar: src ? { src } : undefined,
    }))
})

const { t, locale } = useI18n()
const { loggedIn } = useUserSession()
const commentFormRef = ref<{ active: boolean }>()
const toast = useToast()

const contributions = computed(() => workItem.value?.contributions ?? [])
const selectedContributionNumber = ref<number | null>(null)

const pullSubjectIdsByNumber = computed<Record<number, string>>(() => {
  const result: Record<number, string> = {}
  for (const contribution of contributions.value) {
    if (contribution.subjectId) {
      result[contribution.number] = contribution.subjectId
    }
  }
  return result
})

watch(
  contributions,
  (next) => {
    if (!next.length) {
      selectedContributionNumber.value = null
      return
    }

    if (!selectedContributionNumber.value || !next.some(contribution => contribution.number === selectedContributionNumber.value)) {
      selectedContributionNumber.value = next[0]!.number
    }
  },
  { immediate: true },
)

function timelineKindLabel(kind: string) {
  if (kind === 'comment') return t('workItems.timeline.kind.comment')
  if (kind === 'review') return t('workItems.timeline.kind.review')
  if (kind === 'state') return t('workItems.timeline.kind.state')
  if (kind === 'assignment') return t('workItems.timeline.kind.assignment')
  if (kind === 'label') return t('workItems.timeline.kind.label')
  return t('workItems.timeline.kind.event')
}

const unifiedTimeline = computed(() => workItem.value?.timeline ?? [])

type IssueNonCommentEvent = Exclude<IssueTimelineItem, { type: 'IssueComment' }>

type WorkItemTimelineUiItem = NuxtTimelineItem & {
  id: string
  subjectId?: string
  body?: string
  reactionGroups?: ReactionGroup[]
  kind: WorkItemTimelineEntry['kind']
  isInitial?: boolean
  authorAvatarUrl?: string
  source: WorkItemTimelineEntry['source']
  sourceNumber: number
  action: string
  issueEvent?: IssueNonCommentEvent
}

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

function isBotAuthor(author: string) {
  return /\[bot\]$/i.test(author)
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
      return {
        type: 'UnlabeledEvent',
        actor: entry.author,
        createdAt: entry.createdAt,
        label,
      }
    }

    return {
      type: 'LabeledEvent',
      actor: entry.author,
      createdAt: entry.createdAt,
      label,
    }
  }

  if (entry.kind === 'assignment' && entry.assignee) {
    if (entry.state === 'UNASSIGNED') {
      return {
        type: 'UnassignedEvent',
        actor: entry.author,
        createdAt: entry.createdAt,
        assignee: entry.assignee,
      }
    }

    return {
      type: 'AssignedEvent',
      actor: entry.author,
      createdAt: entry.createdAt,
      assignee: entry.assignee,
    }
  }

  if (entry.kind === 'state') {
    if (entry.state === 'REOPENED') {
      return {
        type: 'ReopenedEvent',
        actor: entry.author,
        createdAt: entry.createdAt,
      }
    }

    if (entry.state === 'CLOSED') {
      return {
        type: 'ClosedEvent',
        actor: entry.author,
        createdAt: entry.createdAt,
        stateReason: 'COMPLETED',
      }
    }
  }

  return null
}

const timelineItems = computed<WorkItemTimelineUiItem[]>(() => {
  return unifiedTimeline.value.map(entry => ({
    id: entry.id,
    subjectId: entry.subjectId,
    date: entry.createdAt,
    title: entry.author,
    description: timelineDescription(entry),
    body: entry.body,
    reactionGroups: entry.reactionGroups,
    kind: entry.kind,
    isInitial: entry.isInitial,
    authorAvatarUrl: entry.authorAvatarUrl,
    icon: timelineIcon(entry),
    source: entry.source,
    sourceNumber: entry.sourceNumber,
    action: timelineAction(entry),
    issueEvent: toIssueEvent(entry) ?? undefined,
    ui: entry.source === 'pull'
      ? {
          item: 'flex-row-reverse',
        }
      : undefined,
  }))
})

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

  return [eventCount, sourceLabel, actorAction, kindSummary, dateLabel]
    .filter(Boolean)
    .join(' • ')
}

function railAriaLabel(entry: TimelineRailEntry) {
  return t('workItems.timeline.scrollToItem', {
    target: entry.tooltip || entry.targetId,
  })
}

function flashTimelineEntry(targetId: string) {
  flashTimelineTargetId.value = targetId

  if (flashTimeout) {
    clearTimeout(flashTimeout)
  }

  flashTimeout = setTimeout(() => {
    if (flashTimelineTargetId.value === targetId) {
      flashTimelineTargetId.value = null
    }
  }, 1400)
}

function scrollToTimelineItem(targetId: string) {
  if (!import.meta.client) return

  const element = document.getElementById(targetId)
  if (!element) return

  activeRailTargetId.value = targetId
  flashTimelineEntry(targetId)
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
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

  if (closestId) {
    activeRailTargetId.value = closestId
  }
}

function setupTimelineObserver() {
  if (!import.meta.client) return

  timelineObserver?.disconnect()
  timelineObserver = null
  visibleTimelineEntries.clear()

  timelineObserver = new IntersectionObserver((entries) => {
    const viewportCenter = window.innerHeight / 2

    for (const entry of entries) {
      const id = (entry.target as HTMLElement).id
      if (!id) continue

      if (entry.isIntersecting) {
        const rect = entry.boundingClientRect
        const center = rect.top + rect.height / 2
        visibleTimelineEntries.set(id, Math.abs(center - viewportCenter))
      }
      else {
        visibleTimelineEntries.delete(id)
      }
    }

    refreshActiveRailFromVisibleEntries()
  }, {
    threshold: [0, 0.25, 0.5, 0.75, 1],
    rootMargin: '-30% 0px -30% 0px',
  })

  for (const item of timelineItems.value) {
    const element = document.getElementById(timelineDomId(item.id))
    if (element) {
      timelineObserver.observe(element)
    }
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

watch(
  timelineItems,
  async () => {
    if (!import.meta.client) return
    await nextTick()
    setupTimelineObserver()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  timelineObserver?.disconnect()
  timelineObserver = null

  if (flashTimeout) {
    clearTimeout(flashTimeout)
    flashTimeout = null
  }
})

const timelineLocalReactions = ref<Record<string, ReactionGroup[]>>({})

watch(
  timelineItems,
  (items) => {
    const next: Record<string, ReactionGroup[]> = {}
    for (const item of items) {
      next[item.id] = timelineLocalReactions.value[item.id] ?? [...(item.reactionGroups ?? [])]
    }
    timelineLocalReactions.value = next
  },
  { immediate: true },
)

function getTimelineReactions(item: WorkItemTimelineUiItem) {
  return timelineLocalReactions.value[item.id] ?? []
}

function getTimelineSubjectId(item: WorkItemTimelineUiItem): string | undefined {
  if (item.subjectId) return item.subjectId

  if (item.isInitial && item.source === 'issue') {
    return issue.value?.id
  }

  if (item.isInitial && item.source === 'pull') {
    return pullSubjectIdsByNumber.value[item.sourceNumber]
  }

  return undefined
}

function onTimelineReactionToggle(item: WorkItemTimelineUiItem, content: string, added: boolean) {
  const reactions = [...getTimelineReactions(item)]
  const index = reactions.findIndex(reaction => reaction.content === content)

  if (added && index === -1) {
    reactions.push({ content, count: 1, viewerHasReacted: true })
  }
  else if (added && index >= 0) {
    reactions[index] = {
      ...reactions[index]!,
      count: reactions[index]!.count + 1,
      viewerHasReacted: true,
    }
  }
  else if (!added && index >= 0) {
    const current = reactions[index]!
    if (current.count <= 1) {
      reactions.splice(index, 1)
    }
    else {
      reactions[index] = {
        ...current,
        count: current.count - 1,
        viewerHasReacted: false,
      }
    }
  }

  timelineLocalReactions.value = {
    ...timelineLocalReactions.value,
    [item.id]: reactions,
  }
}
</script>

<template>
  <div>
    <Teleport to="#page-title-teleport">
      <div class="flex items-center gap-2">
        <NuxtLinkLocale
          :to="`/repos/${owner}/${repoName}/work-items`"
          class="text-sm font-semibold text-highlighted hover:text-primary transition-colors truncate"
        >
          {{ repo }}
        </NuxtLinkLocale>
        <span class="font-mono text-sm text-muted">#{{ number }}</span>
        <RepoStarButton
          :repo="repo"
          show-count
        />
      </div>
    </Teleport>

    <div class="p-4">
      <div
        v-if="workItemStatus === 'pending'"
        class="py-8 text-center text-muted"
      >
        {{ $t('common.loading') }}
      </div>

      <div
        v-else-if="workItemError"
        class="py-8 text-center text-muted"
      >
        {{ workItemError.message }}
      </div>

      <template v-else-if="workItem">
        <WorkItemHeader
          :work-item="workItem"
          :repo="repo"
          :issue="isIssuePrimary ? issue : undefined"
          @ci-status-changed="delayedRefreshWorkItem"
        />

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
              v-if="unifiedTimeline.length"
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
                    class="flex gap-1 rounded-md px-1 py-0.5 transition-colors duration-700 w-fit"
                    :class="[
                      item.source === 'pull' ? 'justify-self-end' : '',
                      flashTimelineTargetId === timelineDomId(item.id) ? 'bg-primary/10 ring-1 ring-primary/40' : '',
                    ]"
                  >
                    <template
                      v-if="item.issueEvent"
                    >
                      <IssueEventGroup
                        :class="item.source === 'pull' ? 'flex justify-end' : ''"
                        :events="[item.issueEvent]"
                        :show-time="false"
                        compact
                      />
                    </template>

                    <template v-else>
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
                    </template>
                  </div>
                </template>

                <template #description="{ item }">
                  <div
                    v-if="item.kind === 'comment' || item.kind === 'review'"
                    class="w-full"
                    :class="item.source === 'pull' ? 'flex justify-end' : ''"
                  >
                    <div class="w-full rounded-md border border-default px-3 py-2 min-w-[16rem] sm:min-w-[20rem] md:min-w-md max-w-full md:max-w-[85%]">
                      <UiMarkdownRenderer
                        v-if="item.body"
                        :source="item.body"
                        :repo-context="repo"
                      />
                      <span
                        v-else
                        class="text-sm text-muted"
                      >
                        {{ item.description }}
                      </span>

                      <IssueReactions
                        v-if="number !== undefined && getTimelineSubjectId(item)"
                        :reactions="getTimelineReactions(item)"
                        :subject-id="getTimelineSubjectId(item)!"
                        :repo="repo"
                        :issue-number="number"
                        class="mt-3"
                        @toggle="(content, added) => onTimelineReactionToggle(item, content, added)"
                      />
                    </div>
                  </div>
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
            v-if="issue"
            class="hidden lg:block"
          >
            <div class="sticky top-48">
              <IssueSidebar
                :issue="issue"
                :repo="repo"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
