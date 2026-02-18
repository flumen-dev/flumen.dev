<script lang="ts" setup>
const props = defineProps<{
  id: string
  body: string
  author: { login: string, avatarUrl: string }
  authorAssociation: AuthorAssociation
  createdAt: string
  viewerCanUpdate: boolean
  reactions: ReactionGroup[]
  repo: string
  issueNumber: number
  mentionUsers?: MentionUser[]
  saveBody: (newBody: string) => Promise<{ id: string, body: string, bodyHTML: string, updatedAt: string } | undefined>
}>()

const { t } = useI18n()
const toast = useToast()

const editingId = useState<string | null>('issue-editing-id', () => null)
const editBody = ref('')
const submitting = ref(false)

const editing = computed(() => props.viewerCanUpdate && editingId.value === props.id)
const editDisabled = computed(() => editingId.value !== null && editingId.value !== props.id)
const { localReactions, onToggle } = useLocalReactions(computed(() => props.reactions))
const { hasDraft, discardDraft, markSavedBaseline } = useMarkdownDraft({
  key: computed(() => `issue-body:${props.id}`),
  value: editBody,
  enabled: editing,
  onRestored: () => {
    toast.add({
      title: t('issues.draft.restored'),
      color: 'info',
    })
  },
})

async function handleTaskToggle({ taskIndex }: TaskToggleDetail) {
  if (!props.viewerCanUpdate) return
  const newBody = toggleTaskInMarkdown(props.body, taskIndex)
  try {
    await props.saveBody(newBody)
  }
  catch {
    toast.add({ title: t('issues.comment.error'), color: 'error' })
  }
}

function startEdit() {
  if (!props.viewerCanUpdate) return
  editBody.value = props.body
  editingId.value = props.id
}

async function saveEdit() {
  if (!props.viewerCanUpdate || !hasMeaningfulMarkdown(editBody.value) || submitting.value) return
  submitting.value = true

  try {
    await props.saveBody(editBody.value)
    markSavedBaseline()
    editingId.value = null
  }
  catch {
    toast.add({ title: t('issues.comment.error'), color: 'error' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    :id="`comment-${id}`"
    class="rounded-lg border border-default bg-default"
  >
    <!-- Author bar -->
    <div class="px-4 py-2 border-b border-default bg-elevated/50 rounded-t-lg flex items-center">
      <UserCard
        :login="author.login"
        :avatar-url="author.avatarUrl"
        :association="authorAssociation"
        :date="createdAt"
      />
      <div
        v-if="viewerCanUpdate && !editing"
        class="ml-auto"
      >
        <UTooltip :text="t('issues.comment.edit')">
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            square
            :disabled="editDisabled"
            @click="startEdit"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Edit mode -->
    <div
      v-if="editing"
      class="p-4"
    >
      <EditorMarkdownEditor
        v-model="editBody"
        :repo-context="repo"
        :mention-users="mentionUsers"
        @submit="saveEdit"
      />
      <div class="flex items-center justify-end gap-2 mt-3">
        <UButton
          :label="t('profile.cancel')"
          color="neutral"
          variant="ghost"
          @click="editingId = null"
        />
        <UButton
          v-if="hasDraft"
          :label="t('issues.draft.discard')"
          color="neutral"
          variant="ghost"
          @click="discardDraft()"
        />
        <UButton
          :label="t('issues.comment.update')"
          icon="i-lucide-send"
          :loading="submitting"
          :disabled="!hasMeaningfulMarkdown(editBody)"
          @click="saveEdit"
        />
      </div>
    </div>

    <!-- Display mode -->
    <div
      v-else
      class="p-4"
    >
      <UiMarkdownRenderer
        :source="body"
        :repo-context="repo"
        :interactive-tasks="viewerCanUpdate"
        @task-toggle="handleTaskToggle"
      />
      <IssueReactions
        :reactions="localReactions"
        :subject-id="id"
        :repo="repo"
        :issue-number="issueNumber"
        class="mt-3"
        @toggle="onToggle"
      />
    </div>
  </div>
</template>
