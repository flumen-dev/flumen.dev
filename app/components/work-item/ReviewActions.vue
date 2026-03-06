<script lang="ts" setup>
import type { Reviewer, ReviewerState } from '~~/shared/types/work-item'

const props = defineProps<{
  reviewers: Reviewer[]
  owner: string
  repo: string
  prNumber: number
  workItemId: string
}>()

const emit = defineEmits<{
  reviewed: []
}>()

const { t } = useI18n()
const toast = useToast()
const { open: openProfile } = useUserProfileDialog()

const ownerRef = computed(() => props.owner)
const repoRef = computed(() => props.repo)
const prNumberRef = computed(() => props.prNumber)

const { user } = useUserSession()
const { submitting, submitReview, getReviewerColor, getReviewerIcon } = useReviewActions(ownerRef, repoRef, prNumberRef)

// Current user's review state
const myReview = computed(() => {
  if (!user.value?.login) return null
  return props.reviewers.find(r => r.login.toLowerCase() === user.value!.login.toLowerCase()) ?? null
})

// Review form state
const expanded = ref(false)
const defaultEvent = computed<'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'>(() => {
  if (!myReview.value) return 'APPROVE'
  if (myReview.value.state === 'APPROVED') return 'COMMENT'
  if (myReview.value.state === 'CHANGES_REQUESTED') return 'APPROVE'
  return 'APPROVE'
})
const selectedEvent = ref(defaultEvent.value)
const reviewBody = ref('')

const bodyRequired = computed(() => selectedEvent.value === 'REQUEST_CHANGES')
const canSubmit = computed(() => {
  if (submitting.value) return false
  if (bodyRequired.value && !reviewBody.value.trim()) return false
  return true
})

const bodyPlaceholder = computed(() =>
  bodyRequired.value
    ? t('workItems.review.bodyRequired')
    : t('workItems.review.bodyPlaceholder'),
)

const eventOptions: Array<{ value: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', icon: string, color: string }> = [
  { value: 'APPROVE', icon: 'i-lucide-check', color: 'text-emerald-500' },
  { value: 'REQUEST_CHANGES', icon: 'i-lucide-file-diff', color: 'text-red-500' },
  { value: 'COMMENT', icon: 'i-lucide-message-square', color: 'text-blue-500' },
]

function getEventLabel(event: string): string {
  switch (event) {
    case 'APPROVE': return t('workItems.review.approve')
    case 'REQUEST_CHANGES': return t('workItems.review.requestChanges')
    case 'COMMENT': return t('workItems.review.comment')
    default: return event
  }
}

const approvalSummary = computed(() => {
  if (!props.reviewers.length) return null
  const approved = props.reviewers.filter(r => r.state === 'APPROVED').length
  return `${approved}/${props.reviewers.length}`
})

function getReviewerStateLabel(state: ReviewerState): string {
  return t(`workItems.review.state.${state}`)
}

async function handleSubmit() {
  if (!canSubmit.value) return
  const result = await submitReview(
    selectedEvent.value,
    reviewBody.value.trim() || undefined,
    props.workItemId,
  )
  if (result) {
    toast.add({ title: t('workItems.review.reviewSubmitted'), color: 'success' })
    reviewBody.value = ''
    expanded.value = false
    emit('reviewed')
  }
  else {
    toast.add({ title: t('workItems.review.reviewFailed'), color: 'error' })
  }
}
</script>

<template>
  <div class="border-t border-accented">
    <!-- Collapsed: reviewer avatars + review button -->
    <div class="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2">
      <!-- Reviewer avatars -->
      <div class="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
        <span
          v-if="!reviewers.length"
          class="text-xs text-muted"
        >
          {{ t('workItems.review.noReviewers') }}
        </span>

        <UTooltip
          v-for="reviewer in reviewers"
          :key="reviewer.login"
          :text="`${reviewer.login} — ${getReviewerStateLabel(reviewer.state)}`"
        >
          <button
            type="button"
            class="relative shrink-0 cursor-pointer"
            @click="openProfile(reviewer.login)"
          >
            <UAvatar
              :src="reviewer.avatarUrl"
              :alt="reviewer.login"
              size="2xs"
            />
            <!-- Status dot -->
            <span
              class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-elevated flex items-center justify-center"
              :class="getReviewerColor(reviewer.state).replace('text-', 'bg-')"
            >
              <UIcon
                :name="getReviewerIcon(reviewer.state)"
                class="size-2 text-white"
              />
            </span>
          </button>
        </UTooltip>

        <span
          v-if="approvalSummary"
          class="text-xs text-muted shrink-0 ml-1"
        >
          {{ approvalSummary }}
        </span>
      </div>

      <!-- Review toggle button -->
      <UButton
        v-if="myReview && !expanded"
        :label="getReviewerStateLabel(myReview.state)"
        :icon="getReviewerIcon(myReview.state)"
        size="xs"
        variant="soft"
        :color="myReview.state === 'APPROVED' ? 'success' : myReview.state === 'CHANGES_REQUESTED' ? 'error' : 'primary'"
        class="shrink-0"
        @click="expanded = !expanded; selectedEvent = defaultEvent"
      />
      <UButton
        v-else
        :label="t('workItems.review.submitReview')"
        icon="i-lucide-eye"
        size="xs"
        :variant="expanded ? 'solid' : 'soft'"
        color="primary"
        class="shrink-0"
        @click="expanded = !expanded; selectedEvent = defaultEvent"
      />
    </div>

    <!-- Expanded: review form -->
    <div
      v-if="expanded"
      class="px-3 sm:px-4 pb-3 space-y-3"
    >
      <!-- Event picker -->
      <div class="flex gap-1.5 mt-2">
        <button
          v-for="opt in eventOptions"
          :key="opt.value"
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
          :class="selectedEvent === opt.value
            ? `${opt.color} ${opt.color.replace('text-', 'bg-')}/15 ring-1 ${opt.color.replace('text-', 'ring-')}/30`
            : 'text-muted hover:text-highlighted hover:bg-elevated/50'"
          @click="selectedEvent = opt.value"
        >
          <UIcon
            :name="opt.icon"
            class="size-3.5"
          />
          <span class="hidden sm:inline">{{ getEventLabel(opt.value) }}</span>
        </button>
      </div>

      <!-- Body textarea -->
      <UTextarea
        v-model="reviewBody"
        :placeholder="bodyPlaceholder"
        size="sm"
        :rows="3"
        autoresize
        :disabled="submitting"
        class="text-sm w-1/1"
      />

      <!-- Submit -->
      <div class="flex items-center gap-2">
        <UButton
          :label="getEventLabel(selectedEvent)"
          :icon="eventOptions.find(o => o.value === selectedEvent)?.icon"
          size="sm"
          :color="selectedEvent === 'REQUEST_CHANGES' ? 'error' : selectedEvent === 'APPROVE' ? 'success' : 'primary'"
          :disabled="!canSubmit"
          :loading="submitting"
          class="flex-1 sm:flex-none"
          @click="handleSubmit"
        />
        <UButton
          :label="t('common.cancel')"
          size="sm"
          variant="ghost"
          color="neutral"
          class="hidden sm:inline-flex"
          @click="expanded = false"
        />
      </div>
    </div>
  </div>
</template>
