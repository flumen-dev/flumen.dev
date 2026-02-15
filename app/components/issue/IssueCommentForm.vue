<script lang="ts" setup>
const props = defineProps<{
  issueId: string
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
const { user } = useUserSession()

const body = ref(props.editComment?.body ?? '')
const submitting = ref(false)
const error = ref('')
const focused = ref(false)
const unpinned = ref(false)

const editingId = useState<string | null>('issue-editing-id', () => null)
const isEdit = computed(() => !!props.editComment)
const someoneEditing = computed(() => !isEdit.value && editingId.value !== null)
const active = computed(() => !unpinned.value && (focused.value || body.value.length > 0))

function unpin() {
  unpinned.value = true
}

watch(focused, (isFocused) => {
  if (isFocused) unpinned.value = false
})

watch(body, () => {
  unpinned.value = false
})

defineExpose({ active })

async function submit() {
  if (!body.value.trim() || submitting.value) return
  submitting.value = true
  error.value = ''

  try {
    if (isEdit.value && props.saveComment) {
      await props.saveComment(props.editComment!.id, body.value)
      emit('saved')
    }
    else if (props.submitComment) {
      await props.submitComment(props.issueId, body.value)
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
  <div
    class="relative rounded-lg border border-default bg-default"
    @focusin="focused = true"
    @focusout="focused = false"
  >
    <!-- Sticky pin indicator -->
    <Transition name="fade">
      <button
        v-if="active"
        class="absolute -top-2 -right-2 z-10 flex items-center justify-center size-5 rounded-full bg-primary text-white shadow-sm cursor-pointer hover:bg-primary/80 transition-colors"
        @mousedown.prevent
        @click.stop="unpin"
      >
        <UIcon
          name="i-lucide-pin"
          class="size-3"
        />
      </button>
    </Transition>

    <!-- Author bar -->
    <div class="px-4 py-2 border-b border-default bg-elevated/50 rounded-t-lg flex items-center gap-2">
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
    </div>

    <div class="p-4">
      <IssueMarkdownEditor
        v-model="body"
        @submit="submit"
      />

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
          :label="isEdit ? t('issues.comment.update') : t('issues.comment.submit')"
          icon="i-lucide-send"
          :loading="submitting"
          :disabled="!body.trim() || someoneEditing"
          @click="submit"
        />
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
