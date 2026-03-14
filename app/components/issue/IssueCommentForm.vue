<script lang="ts" setup>
const props = defineProps<{
  issueId: string
  repoContext?: string
  mentionUsers?: MentionUser[]
  editComment?: TimelineComment
  submitComment?: (subjectId: string, body: string) => Promise<TimelineComment | undefined>
  saveComment?: (id: string, body: string) => Promise<{ id: string, body: string, bodyHTML: string, updatedAt: string } | undefined>
}>()

const emit = defineEmits<{
  submitted: []
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const toast = useToast()
const { user } = useUserSession()

const body = ref(props.editComment?.body ?? '')
const submitting = ref(false)
const error = ref('')
const focused = ref(false)
const pinEnabled = ref(true)
const hydrated = ref(false)

const editingId = useState<string | null>('issue-editing-id', () => null)
const isEdit = computed(() => !!props.editComment)
const someoneEditing = computed(() => !isEdit.value && editingId.value !== null)
const active = computed(() => pinEnabled.value)
const submitDisabled = computed(() => {
  if (!hydrated.value) return true
  return !hasMeaningfulMarkdown(body.value) || someoneEditing.value || submitting.value
})
const draftKey = computed(() => isEdit.value
  ? `issue-comment-edit:${props.editComment?.id || props.issueId}`
  : `issue-comment-new:${props.issueId}`)

const { hasDraft, discardDraft, markSavedBaseline } = useMarkdownDraft({
  key: draftKey,
  value: body,
  onRestored: () => {
    toast.add({
      title: t('issues.draft.restored'),
      color: 'info',
    })
  },
})

function togglePin() {
  pinEnabled.value = !pinEnabled.value
}

onMounted(() => {
  hydrated.value = true
})

async function submit() {
  if (submitDisabled.value) return
  submitting.value = true
  error.value = ''

  try {
    if (isEdit.value && props.saveComment) {
      const result = await props.saveComment(props.editComment!.id, body.value)
      if (!result) {
        throw new Error('Failed to save comment')
      }
      markSavedBaseline()
      emit('saved')
    }
    else if (props.submitComment) {
      const result = await props.submitComment(props.issueId, body.value)
      if (!result) {
        throw new Error('Failed to submit comment')
      }
      markSavedBaseline()
      emit('submitted')
      body.value = ''
    }
  }
  catch {
    error.value = t('issues.comment.error')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div :class="active ? 'sticky bottom-0 z-10' : ''">
    <div
      class="relative rounded-lg border border-default bg-default overflow-hidden"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <EditorMarkdownEditor
        v-model="body"
        :repo-context="props.repoContext"
        :mention-users="props.mentionUsers"
        :framed="false"
        :show-header="true"
        @submit="submit"
      >
        <template #header-left="{ mode, setMode }">
          <div class="flex items-center gap-3">
            <UAvatar
              :src="user?.avatarUrl"
              :alt="user?.login"
              size="xs"
            />
            <span class="text-sm font-medium">{{ user?.login }}</span>
            <span
              v-if="isEdit"
              class="text-xs text-muted"
            >
              {{ t('issues.comment.editing') }}
            </span>

            <div class="h-4 w-px bg-default" />

            <EditorSourceToggle
              :model-value="mode"
              @update:model-value="setMode"
            />
          </div>
        </template>

        <template #header-right>
          <button
            type="button"
            class="flex items-center justify-center size-5 rounded-full transition-colors"
            :class="pinEnabled
              ? 'bg-primary text-white shadow-sm cursor-pointer hover:bg-primary/80'
              : 'bg-elevated text-muted ring-1 ring-default cursor-default'"
            :aria-label="pinEnabled ? t('editor.unpin') : t('editor.pin')"
            :title="pinEnabled ? t('editor.unpin') : t('editor.pin')"
            :aria-pressed="pinEnabled"
            @mousedown.prevent
            @click.stop="togglePin"
          >
            <UIcon
              name="i-lucide-pin"
              class="size-3"
            />
          </button>
        </template>
      </EditorMarkdownEditor>

      <div class="p-4 pt-0">
        <div
          v-if="error"
          class="text-sm text-red-500 mt-3 mb-2"
        >
          {{ error }}
        </div>

        <div class="flex items-center justify-end gap-2 mt-3">
          <UButton
            v-if="isEdit"
            :label="t('profile.cancel')"
            color="neutral"
            variant="ghost"
            @click="emit('cancel')"
          />
          <UButton
            v-if="hasDraft"
            :label="t('issues.draft.discard')"
            color="neutral"
            variant="ghost"
            @click="discardDraft()"
          />
          <UButton
            :label="isEdit ? t('issues.comment.update') : t('issues.comment.submit')"
            icon="i-lucide-send"
            :loading="submitting"
            :disabled="submitDisabled"
            @click="submit"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
