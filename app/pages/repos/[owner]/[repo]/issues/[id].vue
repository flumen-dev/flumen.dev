<script lang="ts" setup>
definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const { t } = useI18n()
const { loggedIn } = useUserSession()
const route = useRoute()
const hasTeleportContent = useState('has-page-title-teleport', () => true)

onUnmounted(() => {
  hasTeleportContent.value = false
})

const owner = computed(() => route.params.owner as string)
const repoName = computed(() => route.params.repo as string)
const number = computed(() => Number(route.params.id))
const repo = computed(() => `${owner.value}/${repoName.value}`)

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

const mentionUsers = computed<MentionUser[]>(() => {
  if (!issue.value) return []

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
  <div>
    <Teleport to="#page-title-teleport">
      <div class="flex items-center gap-2">
        <NuxtLinkLocale
          :to="`/repos/${owner}/${repoName}/issues`"
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
      <IssueHeader
        v-if="issue"
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
        <div class="flex flex-col gap-4 min-w-0">
          <IssueBody
            :id="issue.id"
            :body="issue.body"
            :author="issue.author"
            :author-association="issue.authorAssociation"
            :created-at="issue.createdAt"
            :viewer-can-update="issue.viewerCanUpdate"
            :reactions="issue.reactionGroups"
            :repo="repo"
            :mention-users="mentionUsers"
            :issue-number="number"
            :save-body="saveBody"
          />

          <template
            v-for="(section, idx) in timelineSections"
            :key="idx"
          >
            <IssueComment
              v-if="section.type === 'comment'"
              :comment="section.comment"
              :repo="repo"
              :mention-users="mentionUsers"
              :issue-number="number"
              :save-comment="saveComment"
              :remove-comment="removeComment"
            />
            <IssueEventGroup
              v-else-if="section.type === 'events'"
              :events="section.events"
            />
          </template>

          <div
            v-if="loggedIn && !issue.locked"
            :class="commentFormRef?.active ? 'sticky bottom-0 z-10' : ''"
          >
            <IssueCommentForm
              ref="commentFormRef"
              :issue-id="issue.id"
              :repo-context="repo"
              :mention-users="mentionUsers"
              :submit-comment="submitComment"
              @submitted="toast.add({ title: t('issues.comment.submitted'), color: 'success' })"
            />
          </div>
        </div>

        <div class="hidden lg:block">
          <div class="sticky top-48">
            <IssueSidebar
              :issue="issue"
              :repo="repo"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
