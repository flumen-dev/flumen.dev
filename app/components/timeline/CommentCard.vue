<script lang="ts" setup>
const props = defineProps<{
  author: string
  authorAvatarUrl?: string
  action: string
  createdAt: string
  body?: string
  fallbackDescription?: string
  isBot?: boolean
  isOwnComment?: boolean
  isInitial?: boolean
  reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  source?: 'issue' | 'pull'
  repoContext: string
  reactions?: { content: string, count: number, viewerHasReacted: boolean }[]
  subjectId?: string
  issueNumber?: number
  pullCommentId?: number
  workItemId?: string
}>()

const emit = defineEmits<{
  reactionToggle: [content: string, added: boolean]
}>()

const { t } = useI18n()
const { loggedIn } = useUserSession()

const hovered = ref(false)

const borderClass = computed(() => {
  if (props.isOwnComment) return 'border-primary/40'
  if (props.reviewState === 'APPROVED') return 'border-success/40'
  if (props.reviewState === 'CHANGES_REQUESTED') return 'border-warning/40'
  return 'border-default'
})

const bgClass = computed(() => {
  if (props.isBot) return 'bg-elevated/30'
  if (props.isInitial) return 'bg-elevated/50'
  return ''
})

const headerBgClass = computed(() => {
  if (props.isOwnComment) return 'bg-primary/5'
  if (props.reviewState === 'APPROVED') return 'bg-success/5'
  if (props.reviewState === 'CHANGES_REQUESTED') return 'bg-warning/5'
  return 'bg-elevated/40'
})

const hasReactions = computed(() => {
  return props.reactions?.some(r => r.count > 0) ?? false
})

const hasFooterContent = computed(() => {
  return hasReactions.value || (props.issueNumber !== undefined && props.subjectId)
})

const showQuickReactions = computed(() => {
  return loggedIn.value && hovered.value && props.subjectId && props.issueNumber !== undefined
})
</script>

<template>
  <div
    class="w-full"
    :class="source === 'pull' ? 'flex justify-end' : ''"
  >
    <div
      class="relative w-full rounded-lg border overflow-visible min-w-[16rem] sm:min-w-[20rem] md:min-w-md max-w-full md:max-w-[85%]"
      :class="[borderClass, bgClass]"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <!-- Quick reactions overlay -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="showQuickReactions"
          class="absolute -top-3 right-2 z-10"
        >
          <TimelineQuickReactions
            :subject-id="subjectId!"
            :repo="repoContext"
            :issue-number="issueNumber!"
            :pull-comment-id="pullCommentId"
            :work-item-id="workItemId"
            :reactions="reactions"
            @toggle="(content, added) => emit('reactionToggle', content, added)"
          />
        </div>
      </Transition>

      <!-- Header -->
      <div
        class="flex items-center gap-2 px-3 py-1.5 border-b border-default rounded-t-lg"
        :class="headerBgClass"
      >
        <UserChip
          :login="author"
          :avatar-url="authorAvatarUrl"
          size="2xs"
        />
        <UBadge
          v-if="isBot"
          size="xs"
          color="neutral"
          variant="soft"
        >
          {{ t('workItems.badge.bot') }}
        </UBadge>
        <span class="text-sm text-muted">{{ action }}</span>
        <span class="ml-auto text-xs text-dimmed whitespace-nowrap">{{ timeAgo(createdAt) }}</span>
      </div>

      <!-- Body -->
      <div class="px-3 py-2.5">
        <UiMarkdownRenderer
          v-if="body"
          :source="body"
          :repo-context="repoContext"
        />
        <span
          v-else-if="fallbackDescription"
          class="text-sm text-muted"
        >
          {{ fallbackDescription }}
        </span>
      </div>

      <!-- Review comments section -->
      <slot name="review-comments" />

      <!-- Footer -->
      <div
        v-if="hasFooterContent"
        class="flex items-center gap-2 px-3 py-1.5 border-t border-default"
      >
        <IssueReactions
          v-if="issueNumber !== undefined && subjectId"
          :reactions="reactions ?? []"
          :subject-id="subjectId"
          :repo="repoContext"
          :issue-number="issueNumber!"
          :pull-comment-id="pullCommentId"
          :work-item-id="workItemId"
          @toggle="(content, added) => emit('reactionToggle', content, added)"
        />
      </div>
    </div>
  </div>
</template>
