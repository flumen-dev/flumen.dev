<script lang="ts" setup>
import type { IssueDetail, TimelineComment, TimelineItem } from '~~/shared/types/issue-detail'

definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const route = useRoute()
const apiFetch = useRequestFetch()

const number = computed(() => Number(route.params.id))
const repo = computed(() => route.query.repo as string | undefined)

const { data: issue, status, error } = useAsyncData(
  `issue-${repo.value}-${number.value}`,
  () => {
    if (!repo.value || !number.value) {
      throw createError({ statusCode: 400, message: 'Missing repo or issue number' })
    }
    return apiFetch<IssueDetail>(`/api/issues/${number.value}`, {
      params: { repo: repo.value },
    })
  },
)

const linkedPrs = computed(() => {
  if (!issue.value) return []
  return issue.value.timeline
    .filter(item => item.type === 'CrossReferencedEvent' && item.source.type === 'PullRequest')
    .map((item) => {
      if (item.type !== 'CrossReferencedEvent') return null
      return {
        number: item.source.number,
        title: item.source.title,
        url: item.source.url,
        state: item.source.state,
        actor: item.actor,
      }
    })
    .filter(Boolean) as Array<{ number: number, title: string, url: string, state: string, actor: string }>
})

type NonCommentEvent = Exclude<TimelineItem, { type: 'IssueComment' }>
type TimelineSection
  = { type: 'comment', comment: TimelineComment }
    | { type: 'events', events: NonCommentEvent[] }

const timelineSections = computed<TimelineSection[]>(() => {
  if (!issue.value) return []
  const sections: TimelineSection[] = []
  let pendingEvents: NonCommentEvent[] = []

  for (const item of issue.value.timeline) {
    if (item.type === 'IssueComment') {
      if (pendingEvents.length) {
        sections.push({ type: 'events', events: pendingEvents })
        pendingEvents = []
      }
      sections.push({ type: 'comment', comment: item })
    }
    else {
      pendingEvents.push(item)
    }
  }
  if (pendingEvents.length) {
    sections.push({ type: 'events', events: pendingEvents })
  }

  return sections
})
</script>

<template>
  <div class="p-4">
    <IssueHeader
      v-if="issue"
      :issue="issue"
      :repo="repo!"
      :linked-prs="linkedPrs"
    />

    <div
      v-if="status === 'pending'"
      class="py-8 text-center text-muted"
    >
      {{ $t('common.loading') }}
    </div>

    <div
      v-else-if="error"
      class="py-8 text-center text-muted"
    >
      {{ error.message }}
    </div>

    <div
      v-else-if="issue"
      class="mt-4 lg:grid lg:grid-cols-[1fr_260px] lg:gap-6"
    >
      <!-- Main content -->
      <div class="flex flex-col gap-4 min-w-0">
        <IssueBody
          :id="issue.id"
          :body="issue.body"
          :author="issue.author"
          :author-association="issue.authorAssociation"
          :created-at="issue.createdAt"
          :reactions="issue.reactionGroups"
        />

        <template
          v-for="(section, idx) in timelineSections"
          :key="idx"
        >
          <IssueComment
            v-if="section.type === 'comment'"
            :comment="section.comment"
          />
          <IssueEventGroup
            v-else
            :events="section.events"
          />
        </template>
      </div>

      <!-- Sidebar (desktop only) -->
      <div class="hidden lg:block">
        <div class="sticky top-48">
          <IssueSidebar
            :issue="issue"
            :repo="repo!"
          />
        </div>
      </div>
    </div>
  </div>
</template>
