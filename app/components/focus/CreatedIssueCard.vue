<script setup lang="ts">
import type { CreatedIssueItem, CreatedIssuePR } from '~~/server/api/focus/created.get'

const props = defineProps<{
  item: CreatedIssueItem
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const timeAgo = useTimeAgo(computed(() => props.item.updatedAt))

// --- State ---
const stateColor = computed(() => {
  if (props.item.state === 'OPEN') return 'text-emerald-500'
  if (props.item.stateReason === 'NOT_PLANNED') return 'text-neutral-400'
  return 'text-purple-500'
})

const stateIcon = computed(() => {
  if (props.item.state === 'OPEN') return 'i-lucide-circle-dot'
  if (props.item.stateReason === 'NOT_PLANNED') return 'i-lucide-circle-slash'
  return 'i-lucide-check-circle'
})

// --- Waiting since (feature 1) ---
const waitingDays = computed(() => {
  if (!props.item.needsResponse || !props.item.lastCommentAt) return null
  const days = Math.floor((Date.now() - new Date(props.item.lastCommentAt).getTime()) / (1000 * 60 * 60 * 24))
  return days > 0 ? days : null
})

// --- Heat indicator (feature 2) ---
const heatScore = computed(() => {
  const { reactions, commentCount } = props.item
  return reactions.totalCount + commentCount * 2
})

const heatLevel = computed<'hot' | 'warm' | null>(() => {
  if (props.item.state === 'CLOSED') return null
  if (heatScore.value >= 20) return 'hot'
  if (heatScore.value >= 8) return 'warm'
  return null
})

// --- Stale indicator (feature 5) ---
const isStale = computed(() => {
  if (props.item.state !== 'OPEN') return false
  if (props.item.linkedPrs.length > 0) return false
  const daysSinceUpdate = (Date.now() - new Date(props.item.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceUpdate > 30
})

// --- Reactions ---
const reactionEmojis = [
  { key: 'thumbsUp', emoji: '\uD83D\uDC4D' },
  { key: 'thumbsDown', emoji: '\uD83D\uDC4E' },
  { key: 'laugh', emoji: '\uD83D\uDE04' },
  { key: 'hooray', emoji: '\uD83C\uDF89' },
  { key: 'heart', emoji: '\u2764\uFE0F' },
  { key: 'rocket', emoji: '\uD83D\uDE80' },
  { key: 'eyes', emoji: '\uD83D\uDC40' },
  { key: 'confused', emoji: '\uD83D\uDE15' },
] as const

const activeReactions = computed(() =>
  reactionEmojis.filter(r => props.item.reactions[r.key as keyof typeof props.item.reactions] > 0),
)

// --- PR helpers ---
function prStateColor(pr: CreatedIssuePR) {
  if (pr.isDraft) return 'text-neutral-400'
  if (pr.state === 'MERGED') return 'text-purple-500'
  if (pr.state === 'CLOSED') return 'text-red-500'
  return 'text-emerald-500'
}

function prStateIcon(pr: CreatedIssuePR) {
  if (pr.isDraft) return 'i-lucide-git-pull-request-draft'
  if (pr.state === 'MERGED') return 'i-lucide-git-merge'
  if (pr.state === 'CLOSED') return 'i-lucide-git-pull-request-closed'
  return 'i-lucide-git-pull-request'
}

function prTooltip(pr: CreatedIssuePR) {
  const parts = [`#${pr.number}: ${pr.title}`]
  if (pr.reviewDecision === 'APPROVED') parts.push(t('focus.created.prApproved'))
  else if (pr.reviewDecision === 'CHANGES_REQUESTED') parts.push(t('focus.created.prChangesRequested'))
  if (pr.ciStatus === 'SUCCESS') parts.push(t('focus.created.ciPassed'))
  else if (pr.ciStatus === 'FAILURE') parts.push(t('focus.created.ciFailed'))
  else if (pr.ciStatus === 'PENDING') parts.push(t('focus.created.ciPending'))
  return parts.join(' — ')
}

function ciIcon(pr: CreatedIssuePR) {
  if (pr.ciStatus === 'SUCCESS') return 'i-lucide-circle-check'
  if (pr.ciStatus === 'FAILURE') return 'i-lucide-circle-x'
  if (pr.ciStatus === 'PENDING') return 'i-lucide-loader-2'
  return null
}

function ciColor(pr: CreatedIssuePR) {
  if (pr.ciStatus === 'SUCCESS') return 'text-emerald-500'
  if (pr.ciStatus === 'FAILURE') return 'text-red-500'
  if (pr.ciStatus === 'PENDING') return 'text-amber-400'
  return ''
}
</script>

<template>
  <NuxtLink
    :to="localePath({ path: `/issues/${item.number}`, query: { repo: item.repo } })"
    class="block px-4 py-3 hover:bg-elevated transition-colors border-b border-default last:border-b-0"
    :class="{ 'opacity-60': item.state === 'CLOSED' }"
  >
    <div class="flex items-start gap-3">
      <!-- State icon -->
      <UIcon
        :name="stateIcon"
        class="size-4 mt-0.5 shrink-0"
        :class="stateColor"
      />

      <div class="min-w-0 flex-1">
        <!-- Row 1: Title + number + badges -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-highlighted truncate">
            {{ item.title }}
          </span>
          <span class="text-xs text-dimmed shrink-0">
            #{{ item.number }}
          </span>

          <!-- Heat indicator -->
          <UTooltip
            v-if="heatLevel"
            :text="t('focus.created.heat', { score: heatScore })"
          >
            <UIcon
              name="i-lucide-flame"
              class="size-3.5 shrink-0"
              :class="heatLevel === 'hot' ? 'text-red-500' : 'text-orange-400'"
            />
          </UTooltip>

          <!-- Waiting badge -->
          <UTooltip
            v-if="waitingDays != null"
            :text="t('focus.created.waitingSince', { author: item.lastCommentAuthor })"
          >
            <UBadge
              :label="t('focus.created.waitingDays', { days: waitingDays })"
              color="error"
              variant="subtle"
              size="xs"
              class="shrink-0"
            />
          </UTooltip>

          <!-- Needs response (no waiting days = commented today) -->
          <UBadge
            v-else-if="item.needsResponse"
            :label="t('focus.created.needsResponse')"
            color="warning"
            variant="subtle"
            size="xs"
            class="shrink-0"
          />

          <!-- Stale -->
          <UTooltip
            v-if="isStale"
            :text="t('focus.created.staleHint')"
          >
            <UBadge
              :label="t('focus.created.stale')"
              color="neutral"
              variant="subtle"
              size="xs"
              class="shrink-0"
            />
          </UTooltip>
        </div>

        <!-- Row 2: Repo + labels -->
        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
          <span class="text-xs text-muted">
            {{ item.repo }}
          </span>
          <UBadge
            v-for="label in item.labels.slice(0, 3)"
            :key="label.name"
            :label="label.name"
            :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
            variant="subtle"
            size="xs"
          />
        </div>

        <!-- Row 3: Stats bar -->
        <div class="flex items-center gap-3 mt-1.5 text-xs text-muted">
          <!-- Comments -->
          <UTooltip
            v-if="item.commentCount > 0"
            :text="t('focus.created.comments', { count: item.commentCount })"
          >
            <span class="inline-flex items-center gap-1">
              <UIcon
                name="i-lucide-message-circle"
                class="size-3.5"
              />
              {{ item.commentCount }}
            </span>
          </UTooltip>

          <!-- Reactions -->
          <span
            v-if="item.reactions.totalCount > 0"
            class="inline-flex items-center gap-0.5"
          >
            <span
              v-for="r in activeReactions"
              :key="r.key"
              class="inline-flex items-center gap-0.5"
            >
              {{ r.emoji }}{{ item.reactions[r.key as keyof typeof item.reactions] }}
            </span>
          </span>

          <!-- Assignees -->
          <UTooltip
            v-if="item.assignees.length > 0"
            :text="item.assignees.map(a => a.login).join(', ')"
          >
            <span class="inline-flex items-center gap-1">
              <UIcon
                name="i-lucide-users"
                class="size-3.5"
              />
              <UAvatar
                v-for="a in item.assignees.slice(0, 3)"
                :key="a.login"
                :src="a.avatarUrl"
                :alt="a.login"
                size="3xs"
              />
            </span>
          </UTooltip>

          <!-- Linked PRs with review + CI status -->
          <UTooltip
            v-for="pr in item.linkedPrs"
            :key="pr.number"
            :text="prTooltip(pr)"
          >
            <span
              class="inline-flex items-center gap-0.5"
              :class="prStateColor(pr)"
            >
              <UIcon
                :name="prStateIcon(pr)"
                class="size-3.5"
              />
              #{{ pr.number }}
              <!-- Review decision icon -->
              <UIcon
                v-if="pr.reviewDecision === 'APPROVED'"
                name="i-lucide-check"
                class="size-3 text-emerald-500"
              />
              <UIcon
                v-else-if="pr.reviewDecision === 'CHANGES_REQUESTED'"
                name="i-lucide-message-circle-warning"
                class="size-3 text-orange-400"
              />
              <!-- CI status icon -->
              <UIcon
                v-if="ciIcon(pr)"
                :name="ciIcon(pr)!"
                class="size-3"
                :class="[ciColor(pr), pr.ciStatus === 'PENDING' ? 'animate-spin' : '']"
              />
            </span>
          </UTooltip>

          <!-- Time -->
          <span class="ml-auto shrink-0">
            {{ timeAgo }}
          </span>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
