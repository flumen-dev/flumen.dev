<script setup lang="ts">
import type { UnifiedInboxItem } from '~~/shared/types/inbox'

const props = defineProps<{
  item: UnifiedInboxItem
}>()

const { t } = useI18n()
const toast = useToast()
const store = useFocusStore()
const { open: openProfile } = useUserProfileDialog()
const timeAgo = useTimeAgo(computed(() => props.item.updatedAt))

const isClosed = computed(() => props.item.state !== 'OPEN')

const stateIcon = computed(() => {
  if (props.item.type === 'pr') {
    if (props.item.state === 'MERGED') return 'i-lucide-git-merge'
    if (props.item.isDraft) return 'i-lucide-git-pull-request-draft'
    if (isClosed.value) return 'i-lucide-git-pull-request-closed'
    return 'i-lucide-git-pull-request'
  }
  if (isClosed.value) return 'i-lucide-circle-check'
  return 'i-lucide-circle-dot'
})

const stateColor = computed(() => {
  if (props.item.type === 'pr') {
    if (props.item.state === 'MERGED') return 'text-purple-500'
    if (props.item.isDraft) return 'text-neutral-400'
    if (isClosed.value) return 'text-red-500'
    return 'text-blue-500'
  }
  if (isClosed.value) return 'text-purple-500'
  return 'text-emerald-500'
})

const stateTooltip = computed(() => {
  if (props.item.type === 'pr') {
    if (props.item.state === 'MERGED') return t('focus.inbox.mergedPullRequest')
    if (isClosed.value) return t('focus.inbox.closedPullRequest')
    return t('focus.inbox.pullRequest')
  }
  if (isClosed.value) return t('focus.inbox.closedIssue')
  return t('focus.inbox.issue')
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

const ciTooltip = computed(() => {
  if (props.item.type !== 'pr' || !props.item.ciStatus) return ''
  const map: Record<string, string> = {
    SUCCESS: t('focus.inbox.ciSuccess'),
    FAILURE: t('focus.inbox.ciFailed'),
    PENDING: t('focus.inbox.ciPending'),
  }
  return map[props.item.ciStatus] ?? ''
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

// GitHub profile/repo URLs
const repoUrl = computed(() => `https://github.com/${props.item.repo}`)

async function copyBranch() {
  if (!props.item.headRefName) return
  try {
    await navigator.clipboard.writeText(props.item.headRefName)
    toast.add({ title: t('focus.inbox.branchCopied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('common.copyFailed'), color: 'error' })
  }
}

// --- Inline expandable preview ---
const expanded = ref(false)
const preview = computed(() => store.getPreview(props.item))
const previewLoading = computed(() => store.isPreviewLoading(props.item))

function toggleExpand() {
  expanded.value = !expanded.value
  if (expanded.value && !preview.value && !previewLoading.value) {
    store.fetchPreview(props.item)
  }
}

const prPreview = computed(() =>
  preview.value?.type === 'pr' ? preview.value : null,
)
const issuePreview = computed(() =>
  preview.value?.type === 'issue' ? preview.value : null,
)
</script>

<template>
  <div class="group border-b border-default last:border-b-0">
    <!-- Clickable card area -->
    <div
      class="relative px-4 py-3 hover:bg-elevated transition-colors"
      :class="{ 'opacity-70': isClosed }"
      @click="toggleExpand"
    >
      <div class="flex items-start gap-3">
        <UTooltip :text="stateTooltip">
          <UIcon
            :name="stateIcon"
            class="size-4 mt-0.5 shrink-0"
            :class="stateColor"
          />
        </UTooltip>

        <div class="min-w-0 flex-1">
          <!-- Title line -->
          <div class="flex items-center gap-2 min-w-0">
            <a
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm font-medium text-highlighted truncate hover:underline"
              @click.stop
            >
              {{ item.title }}
            </a>
            <span class="text-xs text-dimmed shrink-0">#{{ item.number }}</span>
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

          <!-- Status row -->
          <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <UBadge
              v-if="item.isDraft"
              :label="$t('repos.badge.draft')"
              color="neutral"
              variant="subtle"
              size="xs"
            />
            <UTooltip
              v-if="hasConflict"
              :text="t('focus.inbox.conflictTooltip')"
            >
              <UBadge
                :label="t('focus.inbox.conflict')"
                color="error"
                variant="subtle"
                size="xs"
                icon="i-lucide-git-merge"
              />
            </UTooltip>
            <UBadge
              v-if="reviewBadge"
              :label="reviewBadge.label"
              :color="reviewBadge.color as any"
              variant="subtle"
              size="xs"
            />
            <UTooltip
              v-if="ciIcon"
              :text="ciTooltip"
            >
              <UIcon
                :name="ciIcon.name"
                class="size-3.5"
                :class="[ciIcon.color, ciIcon.spin ? 'animate-spin' : '']"
              />
            </UTooltip>
            <UTooltip
              v-if="prSize"
              :text="`+${prSize.additions} / -${prSize.deletions} · ${item.changedFiles ?? 0} ${t('focus.inbox.files')}`"
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
        </div>

        <!-- Expand indicator -->
        <UIcon
          :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-4 mt-0.5 shrink-0 text-dimmed"
        />
      </div>

      <!-- Meta row -->
      <div class="mt-2 ml-7 flex flex-col sm:flex-row sm:items-start gap-2">
        <div class="flex items-center gap-2 flex-wrap min-w-0 flex-1 text-xs text-muted">
          <a
            :href="repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium hover:text-highlighted hover:underline"
            @click.stop
          >
            {{ item.repo }}
          </a>

          <UTooltip
            v-if="item.headRefName"
            :text="t('focus.inbox.copyBranch')"
          >
            <button
              class="inline-flex items-center gap-0.5 font-mono bg-muted/50 rounded px-1.5 py-0.5 truncate max-w-40 hover:bg-muted cursor-pointer transition-colors"
              @click.stop="copyBranch"
            >
              <UIcon
                name="i-lucide-git-branch"
                class="size-3 shrink-0"
              />
              {{ item.headRefName }}
            </button>
          </UTooltip>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5 hover:bg-muted transition-colors cursor-pointer"
            @click.stop="openProfile(item.author.login)"
          >
            <UAvatar
              :src="item.author.avatarUrl"
              :alt="item.author.login"
              size="3xs"
            />
            <span class="font-medium">{{ item.author.login }}</span>
          </button>

          <UTooltip
            v-if="item.commentCount > 0"
            :text="t('focus.inbox.commentsTooltip', { count: item.commentCount })"
          >
            <span class="inline-flex items-center gap-0.5">
              <UIcon
                name="i-lucide-message-square"
                class="size-3"
              />
              {{ item.commentCount }}
            </span>
          </UTooltip>

          <span class="text-dimmed">{{ timeAgo }}</span>
        </div>

        <!-- Reviewers / Assignees -->
        <div
          v-if="item.requestedReviewers?.length || item.assignees?.length"
          class="flex items-center gap-1.5 flex-wrap shrink-0"
        >
          <span
            v-if="item.requestedReviewers?.length"
            class="text-[10px] uppercase tracking-wider text-dimmed font-semibold"
          >
            {{ t('focus.inbox.reviewers') }}
          </span>
          <a
            v-for="reviewer in item.requestedReviewers"
            :key="reviewer.login"
            :href="`https://github.com/${reviewer.login}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs bg-muted/50 rounded-full px-2 py-0.5 hover:bg-muted transition-colors"
            @click.stop
          >
            <UAvatar
              :src="reviewer.avatarUrl"
              :alt="reviewer.login"
              size="3xs"
            />
            <span class="text-muted">{{ reviewer.login }}</span>
          </a>

          <span
            v-if="item.assignees?.length"
            class="text-[10px] uppercase tracking-wider text-dimmed font-semibold"
          >
            {{ t('focus.inbox.assigneesLabel') }}
          </span>
          <a
            v-for="assignee in item.assignees"
            :key="assignee.login"
            :href="`https://github.com/${assignee.login}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs bg-muted/50 rounded-full px-2 py-0.5 hover:bg-muted transition-colors"
            @click.stop
          >
            <UAvatar
              :src="assignee.avatarUrl"
              :alt="assignee.login"
              size="3xs"
            />
            <span class="text-muted">{{ assignee.login }}</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Expandable preview section -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out overflow-hidden"
      leave-active-class="transition-all duration-150 ease-in overflow-hidden"
      enter-from-class="max-h-0 opacity-0"
      enter-to-class="max-h-[800px] opacity-100"
      leave-from-class="max-h-[800px] opacity-100"
      leave-to-class="max-h-0 opacity-0"
    >
      <div
        v-if="expanded"
        class="px-4 pb-3 ml-7 border-t border-default/50"
      >
        <!-- Loading -->
        <div
          v-if="previewLoading"
          class="flex items-center gap-2 py-3 text-xs text-muted"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="size-3.5 animate-spin"
          />
          {{ t('focus.inbox.loadingPreview') }}
        </div>

        <!-- PR preview -->
        <div
          v-else-if="prPreview"
          class="py-3 space-y-3 overflow-y-auto max-h-96"
        >
          <div
            v-if="prPreview.lastCommitMessage"
            class="flex items-start gap-2 bg-muted/30 rounded-md px-3 py-2"
          >
            <UIcon
              name="i-lucide-git-commit-horizontal"
              class="size-3.5 mt-0.5 shrink-0 text-muted"
            />
            <p class="text-xs text-muted font-mono">
              {{ prPreview.lastCommitMessage }}
            </p>
          </div>
          <div
            v-if="prPreview.body"
            class="prose prose-xs prose-neutral dark:prose-invert max-w-none"
          >
            <UiMarkdownRenderer
              :source="prPreview.body"
              :repo-context="item.repo"
              :breaks="true"
            />
          </div>
          <p
            v-if="!prPreview.body && !prPreview.lastCommitMessage"
            class="text-xs text-dimmed italic py-1"
          >
            {{ t('focus.inbox.noPreview') }}
          </p>
          <a
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            @click.stop
          >
            {{ t('focus.inbox.openOnGithub') }}
            <UIcon
              name="i-lucide-external-link"
              class="size-3"
            />
          </a>
        </div>

        <!-- Issue preview -->
        <div
          v-else-if="issuePreview"
          class="py-3 space-y-3 overflow-y-auto max-h-96"
        >
          <div
            v-if="issuePreview.milestone"
            class="inline-flex items-center gap-1.5 bg-muted/30 rounded-full px-2.5 py-1"
          >
            <UIcon
              name="i-lucide-milestone"
              class="size-3.5 shrink-0 text-muted"
            />
            <span class="text-xs font-medium text-muted">{{ issuePreview.milestone }}</span>
          </div>
          <div
            v-if="issuePreview.body"
            class="prose prose-xs prose-neutral dark:prose-invert max-w-none"
          >
            <UiMarkdownRenderer
              :source="issuePreview.body"
              :repo-context="item.repo"
              :breaks="true"
            />
          </div>
          <div
            v-if="issuePreview.linkedPRs && issuePreview.linkedPRs.length > 0"
            class="space-y-1"
          >
            <p class="text-[10px] uppercase tracking-wider text-dimmed font-semibold">
              {{ t('focus.inbox.linkedPRs') }}
            </p>
            <a
              v-for="pr in issuePreview.linkedPRs"
              :key="pr.number"
              :href="pr.url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-xs text-muted hover:text-highlighted py-0.5"
            >
              <UIcon
                name="i-lucide-git-pull-request"
                class="size-3 text-blue-500"
              />
              #{{ pr.number }} {{ pr.title }}
            </a>
          </div>
          <p
            v-if="!issuePreview.body && !issuePreview.milestone && (!issuePreview.linkedPRs || issuePreview.linkedPRs.length === 0)"
            class="text-xs text-dimmed italic py-1"
          >
            {{ t('focus.inbox.noPreview') }}
          </p>
          <a
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            @click.stop
          >
            {{ t('focus.inbox.openOnGithub') }}
            <UIcon
              name="i-lucide-external-link"
              class="size-3"
            />
          </a>
        </div>
      </div>
    </Transition>
  </div>
</template>
