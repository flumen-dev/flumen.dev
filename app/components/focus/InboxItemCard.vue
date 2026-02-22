<script setup lang="ts">
import type { InboxItem } from '~~/shared/types/inbox'

type InboxCategory = 'reviewRequests' | 'assigned' | 'mentions'

const props = defineProps<{
  item: InboxItem
  category: InboxCategory
  highlightedKey?: string | null
}>()

const emit = defineEmits<{
  dismiss: [repo: string, number: number]
  hover: [key: string | null]
}>()

const { t } = useI18n()
const itemKey = computed(() => `${props.item.repo}#${props.item.number}`)
const isHighlighted = computed(() => props.highlightedKey === itemKey.value)
const localePath = useLocalePath()
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

// Why is this item in the inbox?
const reasonBadge = computed(() => {
  const map: Record<InboxCategory, { icon: string, label: string, color: string }> = {
    reviewRequests: { icon: 'i-lucide-eye', label: t('focus.inbox.reasonReview'), color: 'primary' },
    assigned: { icon: 'i-lucide-user-check', label: t('focus.inbox.reasonAssigned'), color: 'info' },
    mentions: { icon: 'i-lucide-at-sign', label: t('focus.inbox.reasonMentioned'), color: 'neutral' },
  }
  return map[props.category]
})

// How long has this been waiting?
const waitingDays = computed(() => {
  const ms = Date.now() - new Date(props.item.updatedAt).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return null
  return days
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
</script>

<template>
  <div
    class="group relative flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors border-b border-default last:border-b-0"
    :class="isHighlighted ? 'bg-elevated' : ''"
    @mouseenter="emit('hover', itemKey)"
    @mouseleave="emit('hover', null)"
  >
    <NuxtLink
      :to="item.type === 'issue' ? localePath({ path: `/issues/${item.number}`, query: { repo: item.repo } }) : item.url"
      :external="item.type === 'pr'"
      :target="item.type === 'pr' ? '_blank' : undefined"
      class="absolute inset-0"
    />
    <div class="relative">
      <UIcon
        :name="stateIcon"
        class="size-4 mt-0.5 shrink-0"
        :class="stateColor"
      />
      <span
        v-if="item.isNew"
        class="absolute -top-1 -right-1 size-2 rounded-full bg-primary"
      />
    </div>

    <div class="min-w-0 flex-1">
      <!-- Title row -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-highlighted truncate">
          {{ item.title }}
        </span>
        <span class="text-xs text-dimmed shrink-0">
          #{{ item.number }}
        </span>

        <!-- Reason badge -->
        <UBadge
          :label="reasonBadge.label"
          :color="reasonBadge.color as any"
          variant="subtle"
          size="xs"
          class="shrink-0"
        >
          <template #leading>
            <UIcon
              :name="reasonBadge.icon"
              class="size-3"
            />
          </template>
        </UBadge>

        <!-- Waiting indicator -->
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

      <!-- Meta row -->
      <div class="flex items-center gap-2 mt-0.5 flex-wrap">
        <span class="text-xs text-muted">
          {{ item.repo }}
        </span>

        <UAvatar
          :src="item.author.avatarUrl"
          :alt="item.author.login"
          size="3xs"
        />
        <span class="text-xs text-muted">
          {{ item.author.login }}
        </span>

        <UBadge
          v-if="item.isDraft"
          :label="$t('repos.badge.draft')"
          color="neutral"
          variant="subtle"
          size="xs"
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

        <UBadge
          v-for="label in item.labels.slice(0, 3)"
          :key="label.name"
          :label="label.name"
          :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
          variant="subtle"
          size="xs"
        />

        <span class="ml-auto text-xs text-muted shrink-0">
          {{ timeAgo }}
        </span>
      </div>
    </div>

    <!-- Dismiss / Restore button -->
    <UTooltip :text="item.isDismissed ? t('focus.inbox.restore') : t('focus.inbox.dismiss')">
      <UButton
        :aria-label="item.isDismissed ? t('focus.inbox.restore') : t('focus.inbox.dismiss')"
        :icon="item.isDismissed ? 'i-lucide-eye' : 'i-lucide-eye-off'"
        color="neutral"
        variant="ghost"
        size="xs"
        class="relative z-10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
        @click.prevent="emit('dismiss', item.repo, item.number)"
      />
    </UTooltip>
  </div>
</template>
