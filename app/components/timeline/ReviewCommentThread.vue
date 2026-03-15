<script lang="ts" setup>
const props = defineProps<{
  comment: ReviewComment
  replies?: ReviewComment[]
  repoContext: string
  issueNumber?: number
  selfNumbers?: number[]
  workItemId: string
  currentUserLogin?: string
  reactions: { content: string, count: number, viewerHasReacted: boolean }[]
  replyReactions: Record<string, { content: string, count: number, viewerHasReacted: boolean }[]>
  isReplying: boolean
  replyBody: string
  replySubmitting: boolean
}>()

const effectiveReplies = computed(() => props.replies ?? props.comment.replies ?? [])

const emit = defineEmits<{
  'reactionToggle': [content: string, added: boolean]
  'replyReactionToggle': [replyId: string, content: string, added: boolean]
  'startReply': []
  'cancelReply': []
  'update:replyBody': [value: string]
  'submitReply': []
  'editComment': [id: string, databaseId: number, body: string]
  'deleteComment': [id: string, databaseId: number]
  'editReply': [id: string, databaseId: number, body: string]
  'deleteReply': [id: string, databaseId: number]
}>()

const { t } = useI18n()
const { loggedIn } = useUserSession()

const replyModel = computed({
  get: () => props.replyBody,
  set: (v: string) => emit('update:replyBody', v),
})

const hoveredReplyId = ref<string | null>(null)
const editingCommentId = ref<string | null>(null)
const editBody = ref('')
const confirmDeleteOpen = ref(false)
const pendingDelete = ref<{ id: string, databaseId: number, type: 'comment' | 'reply' } | null>(null)

function startEditComment(comment: ReviewComment) {
  editingCommentId.value = comment.id
  editBody.value = comment.body
}

function cancelEdit() {
  editingCommentId.value = null
  editBody.value = ''
}

function saveEdit(comment: ReviewComment, type: 'comment' | 'reply') {
  if (!editBody.value.trim() || !comment.databaseId) return
  if (type === 'comment') {
    emit('editComment', comment.id, comment.databaseId, editBody.value)
  }
  else {
    emit('editReply', comment.id, comment.databaseId, editBody.value)
  }
  editingCommentId.value = null
  editBody.value = ''
}

function requestDelete(comment: ReviewComment, type: 'comment' | 'reply') {
  if (!comment.databaseId) return
  pendingDelete.value = { id: comment.id, databaseId: comment.databaseId, type }
  confirmDeleteOpen.value = true
}

function executeDelete() {
  if (!pendingDelete.value) return
  const { id, databaseId, type } = pendingDelete.value
  if (type === 'comment') {
    emit('deleteComment', id, databaseId)
  }
  else {
    emit('deleteReply', id, databaseId)
  }
  pendingDelete.value = null
}
</script>

<template>
  <div
    class="rounded-md border border-default bg-elevated/50 px-3 py-2"
    :class="comment.outdated ? 'opacity-70' : ''"
  >
    <!-- Root comment header -->
    <div class="flex items-center gap-2 mb-1.5">
      <UBadge
        size="sm"
        color="neutral"
        variant="subtle"
        class="font-mono"
      >
        {{ comment.path }}{{ comment.line != null ? `:${comment.line}` : '' }}
      </UBadge>
      <UBadge
        v-if="comment.outdated"
        size="xs"
        color="warning"
        variant="soft"
      >
        {{ t('workItems.timeline.outdated') }}
      </UBadge>
      <div class="ml-auto flex items-center gap-1">
        <TimelineEditActions
          :can-update="comment.viewerCanUpdate"
          :can-delete="comment.viewerCanDelete"
          :edit-disabled="editingCommentId !== null"
          @edit="startEditComment(comment)"
          @delete="requestDelete(comment, 'comment')"
        />
        <span class="text-[11px] text-dimmed whitespace-nowrap">{{ timeAgo(comment.createdAt) }}</span>
      </div>
    </div>

    <TimelineDiffHunkViewer
      v-if="comment.diffHunk"
      :diff-hunk="comment.diffHunk"
      :path="comment.path"
      :outdated="comment.outdated"
      class="mb-2"
    />

    <!-- Root comment body -->
    <template v-if="editingCommentId === comment.id">
      <EditorMarkdownEditor
        v-model="editBody"
        :repo-context="repoContext"
      />
      <div class="flex gap-2 mt-2">
        <UButton
          size="xs"
          :disabled="!editBody.trim()"
          @click="saveEdit(comment, 'comment')"
        >
          {{ t('workItems.timeline.save') }}
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          @click="cancelEdit()"
        >
          {{ t('common.cancel') }}
        </UButton>
      </div>
    </template>
    <UiMarkdownRenderer
      v-else
      :source="comment.body"
      :repo-context="repoContext"
      :self-numbers="selfNumbers"
    />

    <IssueReactions
      v-if="issueNumber !== undefined && comment.databaseId"
      :reactions="reactions"
      :subject-id="comment.id"
      :repo="repoContext"
      :issue-number="issueNumber!"
      :pull-comment-id="comment.databaseId"
      :work-item-id="workItemId"
      class="mt-2"
      @toggle="(content, added) => emit('reactionToggle', content, added)"
    />

    <!-- Replies -->
    <div
      v-if="effectiveReplies?.length"
      class="mt-3 space-y-2 border-l-2 border-primary/20 pl-3"
    >
      <div
        v-for="reply in effectiveReplies"
        :key="reply.id"
        class="relative rounded-md border border-default overflow-visible"
        :class="reply.author === currentUserLogin ? 'border-primary/30' : ''"
        @mouseenter="hoveredReplyId = reply.id"
        @mouseleave="hoveredReplyId = null"
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
            v-if="loggedIn && hoveredReplyId === reply.id && issueNumber !== undefined && reply.databaseId"
            class="absolute -top-7 right-2 z-10"
          >
            <TimelineQuickReactions
              :subject-id="reply.id"
              :repo="repoContext"
              :issue-number="issueNumber!"
              :pull-comment-id="reply.databaseId"
              :work-item-id="workItemId"
              :reactions="replyReactions[reply.id]"
              @toggle="(content, added) => emit('replyReactionToggle', reply.id, content, added)"
            />
          </div>
        </Transition>

        <!-- Reply header: author — edit — delete — timestamp -->
        <div
          class="flex items-center gap-2 px-2.5 py-1 border-b border-default rounded-t-md"
          :class="reply.author === currentUserLogin ? 'bg-primary/5' : 'bg-elevated/40'"
        >
          <UserChip
            :login="reply.author"
            :avatar-url="reply.authorAvatarUrl"
            size="3xs"
          />
          <UBadge
            v-if="isBotAuthor(reply.author)"
            size="xs"
            color="neutral"
            variant="soft"
          >
            {{ t('workItems.badge.bot') }}
          </UBadge>
          <div class="ml-auto flex items-center gap-1">
            <TimelineEditActions
              :can-update="reply.viewerCanUpdate"
              :can-delete="reply.viewerCanDelete"
              :edit-disabled="editingCommentId !== null"
              size="xs"
              @edit="startEditComment(reply)"
              @delete="requestDelete(reply, 'reply')"
            />
            <span class="text-[11px] text-dimmed whitespace-nowrap">{{ timeAgo(reply.createdAt) }}</span>
          </div>
        </div>

        <!-- Reply body -->
        <div class="px-2.5 py-1.5 text-sm">
          <template v-if="editingCommentId === reply.id">
            <EditorMarkdownEditor
              v-model="editBody"
              :repo-context="repoContext"
            />
            <div class="flex gap-2 mt-2">
              <UButton
                size="xs"
                :disabled="!editBody.trim()"
                @click="saveEdit(reply, 'reply')"
              >
                {{ t('workItems.timeline.save') }}
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="cancelEdit()"
              >
                {{ t('common.cancel') }}
              </UButton>
            </div>
          </template>
          <UiMarkdownRenderer
            v-else
            :source="reply.body"
            :repo-context="repoContext"
          />
        </div>

        <div
          v-if="issueNumber !== undefined && reply.databaseId && (replyReactions[reply.id]?.length ?? 0) > 0"
          class="px-2.5 py-1 border-t border-default"
        >
          <IssueReactions
            :reactions="replyReactions[reply.id] ?? []"
            :subject-id="reply.id"
            :repo="repoContext"
            :issue-number="issueNumber!"
            :pull-comment-id="reply.databaseId"
            :work-item-id="workItemId"
            @toggle="(content, added) => emit('replyReactionToggle', reply.id, content, added)"
          />
        </div>
      </div>
    </div>

    <!-- Reply button & form -->
    <div
      v-if="loggedIn && comment.databaseId"
      class="mt-2"
    >
      <button
        v-if="!isReplying"
        type="button"
        class="text-xs text-muted hover:text-highlighted transition-colors"
        @click="emit('startReply')"
      >
        {{ t('workItems.timeline.reply') }}
      </button>

      <div
        v-else
        class="flex flex-col gap-2"
      >
        <EditorMarkdownEditor
          v-model="replyModel"
          :repo-context="repoContext"
          :placeholder="t('workItems.timeline.replyPlaceholder')"
          min-height="8rem"
        />
        <div class="flex gap-2">
          <UButton
            size="xs"
            :loading="replySubmitting"
            :disabled="!replyModel.trim()"
            @click="emit('submitReply')"
          >
            {{ t('workItems.timeline.reply') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            @click="emit('cancelReply')"
          >
            {{ t('common.close') }}
          </UButton>
        </div>
      </div>
    </div>

    <TimelineDeleteModal
      v-model:open="confirmDeleteOpen"
      @confirm="executeDelete()"
    />
  </div>
</template>
