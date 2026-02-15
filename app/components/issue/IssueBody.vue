<script lang="ts" setup>
const props = defineProps<{
  id: string
  body: string
  author: { login: string, avatarUrl: string }
  authorAssociation: AuthorAssociation
  createdAt: string
  reactions: ReactionGroup[]
  repo: string
  issueNumber: number
  saveBody: (newBody: string) => Promise<{ id: string, body: string, bodyHTML: string, updatedAt: string } | undefined>
}>()

const { t } = useI18n()
const { user } = useUserSession()
const toast = useToast()

const editingId = useState<string | null>('issue-editing-id', () => null)
const editBody = ref('')
const submitting = ref(false)

const editing = computed(() => editingId.value === props.id)
const editDisabled = computed(() => editingId.value !== null && editingId.value !== props.id)
const isOwn = computed(() => user.value?.login === props.author.login)
const enhancedBody = computed(() => linkifyMentions(props.body))
const localReactions = ref([...props.reactions])

function startEdit() {
  editBody.value = props.body
  editingId.value = props.id
}

async function saveEdit() {
  if (!editBody.value.trim() || submitting.value) return
  submitting.value = true

  try {
    await props.saveBody(editBody.value)
    editingId.value = null
  }
  catch {
    toast.add({ title: t('issues.comment.error'), color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

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
        v-if="isOwn && !editing"
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
      <IssueMarkdownEditor
        v-model="editBody"
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
          :label="t('issues.comment.update')"
          icon="i-lucide-send"
          :loading="submitting"
          :disabled="!editBody.trim()"
          @click="saveEdit"
        />
      </div>
    </div>

    <!-- Display mode -->
    <div
      v-else
      class="p-4"
    >
      <UEditor
        :model-value="enhancedBody"
        content-type="markdown"
        :editable="false"
        :mention="false"
        :extensions="[LinkEnhancer]"
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
