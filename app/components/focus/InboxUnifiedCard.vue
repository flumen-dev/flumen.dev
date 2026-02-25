<script setup lang="ts">
import type { UnifiedInboxItem } from '~~/shared/types/inbox'

const props = defineProps<{
  item: UnifiedInboxItem
}>()

const emit = defineEmits<{
  dismiss: [repo: string, number: number]
}>()

const { t } = useI18n()
const timeAgo = useTimeAgo(computed(() => props.item.updatedAt))

const stateIcon = computed(() => {
  if (props.item.type === 'pr') {
    return props.item.isDraft ? 'i-lucide-git-pull-request-draft' : 'i-lucide-git-pull-request'
  }
  return 'i-lucide-circle-dot'
})

const stateColor = computed(() => {
  if (props.item.type === 'pr') {
    return props.item.isDraft ? 'text-neutral-400' : 'text-blue-500'
  }
  return 'text-emerald-500'
})

const waitingDays = computed(() => {
  const ms = Date.now() - new Date(props.item.updatedAt).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  return days <= 0 ? null : days
})

const waitingColor = computed(() => {
  const days = waitingDays.value
  if (!days) return 'neutral'
  if (days >= 7) return 'error'
  if (days >= 3) return 'warning'
  return 'neutral'
})

const reviewBadge = computed(() => {
  if (props.item.type !== 'pr' || !props.item.reviewDecision) return null
  const map: Record<string, { label: string, color: string }> = {
    APPROVED: { label: t('focus.inbox.approved'), color: 'success' },
    CHANGES_REQUESTED: { label: t('focus.inbox.changesRequested'), color: 'warning' },
    REVIEW_REQUIRED: { label: t('focus.inbox.reviewRequired'), color: 'primary' },
  }
  return map[props.item.reviewDecision] ?? null
})

const ciIcon = computed(() => {
  if (props.item.type !== 'pr' || !props.item.ciStatus) return null
  const map: Record<string, { name: string, color: string, spin?: boolean }> = {
    SUCCESS: { name: 'i-lucide-circle-check', color: 'text-emerald-500' },
    FAILURE: { name: 'i-lucide-circle-x', color: 'text-red-500' },
    PENDING: { name: 'i-lucide-loader-2', color: 'text-amber-400', spin: true },
  }
  return map[props.item.ciStatus] ?? null
})

const hasConflict = computed(() =>
  props.item.type === 'pr' && props.item.mergeable === 'CONFLICTING',
)

const prSize = computed(() => {
  if (props.item.type !== 'pr') return null
  return { additions: props.item.additions ?? 0, deletions: props.item.deletions ?? 0 }
})

const prSizeLabel = computed(() => {
  if (!prSize.value) return ''
  const total = prSize.value.additions + prSize.value.deletions
  if (total <= 50) return 'S'
  if (total <= 200) return 'M'
  if (total <= 500) return 'L'
  return 'XL'
})

const prSizeColor = computed(() => {
  if (!prSize.value) return 'neutral'
  const total = prSize.value.additions + prSize.value.deletions
  if (total <= 50) return 'success'
  if (total <= 200) return 'primary'
  if (total <= 500) return 'warning'
  return 'error'
})
</script>

<template>
  <div class="group border-b border-default last:border-b-0">
    <div class="relative flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors">
      <UIcon
        :name="stateIcon"
        class="size-4 mt-0.5 shrink-0"
        :class="stateColor"
      />

      <div class="min-w-0 flex-1">
        <!-- Row 1: Title + number + waiting badge -->
        <div class="flex items-center gap-2">
          <a
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-medium text-highlighted truncate hover:underline"
          >
            {{ item.title }}
          </a>
          <span class="text-xs text-dimmed shrink-0">
            #{{ item.number }}
          </span>

          <UTooltip
            v-if="waitingDays"
            :text="t('focus.inbox.waitingSince', { days: waitingDays })"
          >
            <UBadge
              :label="t('focus.inbox.waitingDays', { days: waitingDays })"
              :color="waitingColor as any"
              variant="subtle"
              size="xs"
              class="shrink-0"
            />
          </UTooltip>
        </div>

        <!-- Row 2: Status badges -->
        <div class="flex items-center gap-1.5 mt-1 flex-wrap">
          <UBadge
            v-if="item.isDraft"
            :label="$t('repos.badge.draft')"
            color="neutral"
            variant="subtle"
            size="xs"
          />

          <UBadge
            v-if="hasConflict"
            :label="t('focus.inbox.conflict')"
            color="error"
            variant="subtle"
            size="xs"
            icon="i-lucide-git-merge"
          />

          <UBadge
            v-if="reviewBadge"
            :label="reviewBadge.label"
            :color="reviewBadge.color as any"
            variant="subtle"
            size="xs"
          />

          <UIcon
            v-if="ciIcon"
            :name="ciIcon.name"
            class="size-3.5"
            :class="[ciIcon.color, ciIcon.spin ? 'animate-spin' : '']"
          />

          <UTooltip
            v-if="prSize"
            :text="`+${prSize.additions} / -${prSize.deletions}`"
          >
            <UBadge
              :label="prSizeLabel"
              :color="prSizeColor as any"
              variant="subtle"
              size="xs"
            />
          </UTooltip>

          <UBadge
            v-for="label in item.labels.slice(0, 3)"
            :key="label.name"
            :label="label.name"
            :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
            variant="subtle"
            size="xs"
          />
        </div>

        <!-- Row 3: Meta info -->
        <div class="flex items-center gap-2.5 mt-1">
          <span class="text-xs text-muted">
            {{ item.repo }}
          </span>

          <span class="inline-flex items-center gap-1 text-xs text-muted">
            <UAvatar
              :src="item.author.avatarUrl"
              :alt="item.author.login"
              size="3xs"
            />
            {{ item.author.login }}
          </span>

          <span
            v-if="item.commentCount > 0"
            class="inline-flex items-center gap-0.5 text-xs text-muted"
          >
            <UIcon
              name="i-lucide-message-square"
              class="size-3"
            />
            {{ item.commentCount }}
          </span>

          <!-- Requested reviewers (PR) -->
          <div
            v-if="item.requestedReviewers?.length"
            class="inline-flex items-center -space-x-1.5"
          >
            <UTooltip
              v-for="reviewer in item.requestedReviewers"
              :key="reviewer.login"
              :text="reviewer.login"
            >
              <UAvatar
                :src="reviewer.avatarUrl"
                :alt="reviewer.login"
                size="3xs"
                class="ring-1 ring-default"
              />
            </UTooltip>
          </div>

          <!-- Assignees (Issue) -->
          <div
            v-if="item.assignees?.length"
            class="inline-flex items-center -space-x-1.5"
          >
            <UTooltip
              v-for="assignee in item.assignees"
              :key="assignee.login"
              :text="assignee.login"
            >
              <UAvatar
                :src="assignee.avatarUrl"
                :alt="assignee.login"
                size="3xs"
                class="ring-1 ring-default"
              />
            </UTooltip>
          </div>

          <span class="ml-auto text-xs text-muted shrink-0">
            {{ timeAgo }}
          </span>
        </div>
      </div>

      <UTooltip :text="item.isDismissed ? t('focus.inbox.restore') : t('focus.inbox.dismiss')">
        <UButton
          :aria-label="item.isDismissed ? t('focus.inbox.restore') : t('focus.inbox.dismiss')"
          :icon="item.isDismissed ? 'i-lucide-eye' : 'i-lucide-eye-off'"
          color="neutral"
          variant="ghost"
          size="xs"
          class="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          @click="emit('dismiss', item.repo, item.number)"
        />
      </UTooltip>
    </div>
  </div>
</template>
