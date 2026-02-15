<script lang="ts" setup>
const props = defineProps<{
  comment: TimelineComment
  repo: string
  issueNumber: number
  saveComment: (id: string, body: string) => Promise<{ id: string, body: string, bodyHTML: string, updatedAt: string } | undefined>
  removeComment: (id: string) => Promise<void>
}>()

const { t } = useI18n()
const { user } = useUserSession()
const toast = useToast()

const editingId = useState<string | null>('issue-editing-id', () => null)
const deleting = ref(false)
const confirmDelete = ref(false)

const editing = computed(() => editingId.value === props.comment.id)
const editDisabled = computed(() => editingId.value !== null && editingId.value !== props.comment.id)
const isOwn = computed(() => user.value?.login === props.comment.author.login)

const enhancedBody = computed(() => linkifyMentions(props.comment.body))
const localReactions = ref([...props.comment.reactionGroups])

function onToggle(content: string, added: boolean) {
  const idx = localReactions.value.findIndex(r => r.content === content)
  if (added && idx === -1) {
    localReactions.value.push({ content, count: 1, viewerHasReacted: true })
  }
  else if (added && idx >= 0) {
    localReactions.value[idx] = { ...localReactions.value[idx]!, count: localReactions.value[idx]!.count + 1, viewerHasReacted: true }
  }
  else if (!added && idx >= 0) {
    const current = localReactions.value[idx]!
    if (current.count <= 1) {
      localReactions.value.splice(idx, 1)
    }
    else {
      localReactions.value[idx] = { ...current, count: current.count - 1, viewerHasReacted: false }
    }
  }
}

function onUpdated() {
  editingId.value = null
}

async function deleteComment() {
  deleting.value = true
  try {
    await props.removeComment(props.comment.id)
    toast.add({ title: t('issues.comment.deleted'), color: 'success' })
  }
  catch {
    toast.add({ title: t('issues.comment.deleteError'), color: 'error' })
  }
  finally {
    deleting.value = false
    confirmDelete.value = false
  }
}
</script>

<template>
  <!-- Edit mode -->
  <IssueCommentForm
    v-if="editing"
    :issue-id="comment.id"
    :edit-comment="comment"
    :save-comment="saveComment"
    @saved="onUpdated"
    @cancel="editingId = null"
  />

  <!-- Display mode -->
  <div
    v-else
    :id="`comment-${comment.id}`"
    class="rounded-lg border border-default bg-default"
  >
    <!-- Author bar -->
    <div class="px-4 py-2 border-b border-default bg-elevated/50 rounded-t-lg flex items-center">
      <UserCard
        :login="comment.author.login"
        :avatar-url="comment.author.avatarUrl"
        :association="comment.authorAssociation"
        :date="comment.createdAt"
      />
      <div
        v-if="isOwn"
        class="ml-auto flex items-center gap-1"
      >
        <UTooltip :text="t('issues.comment.edit')">
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            square
            :disabled="editDisabled"
            @click="editingId = comment.id"
          />
        </UTooltip>
        <UTooltip :text="t('issues.comment.delete')">
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            square
            @click="confirmDelete = true"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Markdown body -->
    <div class="p-4">
      <UEditor
        :model-value="enhancedBody"
        content-type="markdown"
        :editable="false"
        :mention="false"
        :extensions="[LinkEnhancer]"
      />
      <IssueReactions
        :reactions="localReactions"
        :subject-id="comment.id"
        :repo="repo"
        :issue-number="issueNumber"
        class="mt-3"
        @toggle="onToggle"
      />
    </div>

    <!-- Delete confirmation dialog -->
    <UModal v-model:open="confirmDelete">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">
            {{ t('issues.comment.confirmDeleteTitle') }}
          </h3>
          <p class="text-sm text-muted mb-4">
            {{ t('issues.comment.confirmDeleteDescription') }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('profile.cancel')"
              color="neutral"
              variant="ghost"
              @click="confirmDelete = false"
            />
            <UButton
              :label="t('issues.comment.delete')"
              color="error"
              icon="i-lucide-trash-2"
              :loading="deleting"
              @click="deleteComment"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
