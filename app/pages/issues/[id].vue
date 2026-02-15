<script lang="ts" setup>
const { t } = useI18n()
const { loggedIn } = useUserSession()

definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const route = useRoute()

const number = computed(() => Number(route.params.id))
const repo = computed(() => route.query.repo as string | undefined)

const {
  issue,
  status,
  error,
  saveBody,
  submitComment,
  saveComment,
  removeComment,
} = useIssueDetail(repo, number)

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

const commentFormRef = ref<{ active: boolean }>()
const toast = useToast()
</script>

<template>
  <div class="p-4">
    <IssueHeader
      v-if="issue && repo"
      :issue="issue"
      :repo="repo"
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
          :repo="repo!"
          :issue-number="number"
          :save-body="saveBody"
        />

        <template
          v-for="(section, idx) in timelineSections"
          :key="idx"
        >
          <IssueComment
            v-if="section.type === 'comment' && repo"
            :comment="section.comment"
            :repo="repo"
            :issue-number="number"
            :save-comment="saveComment"
            :remove-comment="removeComment"
          />
          <IssueEventGroup
            v-else-if="section.type === 'events'"
            :events="section.events"
          />
        </template>

        <!-- Add comment -->
        <div
          v-if="loggedIn && !issue.locked && repo"
          :class="commentFormRef?.active ? 'sticky bottom-0 z-10' : ''"
        >
          <IssueCommentForm
            ref="commentFormRef"
            :issue-id="issue.id"
            :submit-comment="submitComment"
            @submitted="toast.add({ title: t('issues.comment.submitted'), color: 'success' })"
          />
        </div>
      </div>

      <!-- Sidebar (desktop only) -->
      <div class="hidden lg:block">
        <div class="sticky top-48">
          <IssueSidebar
            v-if="repo"
            :issue="issue"
            :repo="repo"
          />
        </div>
      </div>
    </div>
  </div>
</template>
