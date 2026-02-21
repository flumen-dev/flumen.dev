<script lang="ts" setup>
import type { IssueDetail } from '~~/shared/types/issue-detail'

export interface LinkedPr {
  number: number
  title: string
  url: string
  state: string
  actor: string
}

const props = defineProps<{
  issue: IssueDetail
  repo: string
  linkedPrs: LinkedPr[]
}>()

const { t } = useI18n()
const toast = useToast()

const createdAgo = useTimeAgo(computed(() => props.issue.createdAt))
const updatedAgo = useTimeAgo(computed(() => props.issue.updatedAt))

const commentCount = computed(() =>
  props.issue.timeline.filter(item => item.type === 'IssueComment').length,
)

// --- Row 1: State ---

const stateIcon = computed(() => {
  if (props.issue.state === 'OPEN') return 'i-lucide-circle-dot'
  if (props.issue.stateReason === 'NOT_PLANNED') return 'i-lucide-circle-slash'
  return 'i-lucide-check-circle'
})

const stateColor = computed(() => {
  if (props.issue.state === 'OPEN') return 'text-emerald-500'
  if (props.issue.stateReason === 'NOT_PLANNED') return 'text-neutral-400'
  return 'text-violet-500'
})

const stateLabel = computed(() => {
  if (props.issue.state === 'OPEN') return t('issues.open')
  if (props.issue.stateReason === 'NOT_PLANNED') return t('issues.closedAsNotPlanned')
  return t('issues.closedAs')
})

function copyLink() {
  navigator.clipboard.writeText(props.issue.url)
  toast.add({ title: t('common.copied'), color: 'success' })
}

// --- Row 2: Assignees + PRs ---

const assigneesWithPr = computed(() =>
  props.issue.assignees.map(assignee => ({
    ...assignee,
    pr: props.linkedPrs.find(pr => pr.actor === assignee.login) ?? null,
  })),
)

const unlinkedPrs = computed(() =>
  props.linkedPrs.filter(pr => !props.issue.assignees.some(a => a.login === pr.actor)),
)

function prStateIcon(state: string) {
  switch (state) {
    case 'OPEN': return 'i-lucide-git-pull-request'
    case 'MERGED': return 'i-lucide-git-merge'
    case 'CLOSED': return 'i-lucide-git-pull-request-closed'
    default: return 'i-lucide-git-pull-request'
  }
}

function prStateColor(state: string) {
  switch (state) {
    case 'OPEN': return 'text-emerald-500'
    case 'MERGED': return 'text-violet-500'
    case 'CLOSED': return 'text-red-500'
    default: return 'text-muted'
  }
}
</script>

<template>
  <div class="sticky top-0 z-10 border border-default rounded-xl sm:rounded-2xl bg-elevated/95 shadow-sm backdrop-blur">
    <!-- Row 1: State + Title + Actions -->
    <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
      <UTooltip :text="stateLabel">
        <span
          class="inline-flex items-center justify-center size-7 rounded-full shrink-0"
          :class="issue.state === 'OPEN' ? 'bg-emerald-500/10' : issue.stateReason === 'NOT_PLANNED' ? 'bg-neutral-500/10' : 'bg-violet-500/10'"
        >
          <UIcon
            :name="stateIcon"
            class="size-4"
            :class="stateColor"
          />
        </span>
      </UTooltip>

      <h1 class="flex-1 min-w-0 text-base sm:text-lg font-semibold text-highlighted truncate">
        {{ issue.title }}
      </h1>

      <span class="font-mono text-muted text-xs sm:text-sm shrink-0">#{{ issue.number }}</span>

      <div class="flex items-center gap-0.5 shrink-0">
        <UTooltip :text="t('common.copyLink')">
          <UButton
            icon="i-lucide-link"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="copyLink"
          />
        </UTooltip>
        <UTooltip :text="t('common.viewOnGithub')">
          <UButton
            icon="i-lucide-external-link"
            variant="ghost"
            color="neutral"
            size="xs"
            :to="issue.url"
            target="_blank"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Row 2: Assignment Zone -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3 px-3 sm:px-4 py-2 border-t border-accented">
      <!-- Left: Assignees + PRs -->
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <!-- No assignees -->
        <UBadge
          v-if="issue.assignees.length === 0"
          :label="t('issues.detail.needsOwner')"
          color="warning"
          variant="subtle"
          icon="i-lucide-user-x"
        />

        <!-- Assignees with PR status -->
        <div
          v-for="assignee in assigneesWithPr"
          :key="assignee.login"
          class="flex items-center gap-1.5"
        >
          <UAvatar
            :src="assignee.avatarUrl"
            :alt="assignee.login"
            size="2xs"
          />
          <span class="text-sm font-medium text-highlighted hidden sm:inline">{{ assignee.login }}</span>

          <a
            v-if="assignee.pr"
            :href="assignee.pr.url"
            target="_blank"
            class="inline-flex items-center gap-1 rounded-full border border-default bg-elevated/50 px-2 py-0.5 text-xs hover:border-primary/50 transition-colors"
          >
            <UIcon
              :name="prStateIcon(assignee.pr.state)"
              class="size-3.5"
              :class="prStateColor(assignee.pr.state)"
            />
            <span class="text-muted">#{{ assignee.pr.number }}</span>
          </a>

          <span
            v-else
            class="text-xs text-muted hidden sm:inline"
          >
            {{ t('issues.detail.noBranchYet') }}
          </span>
        </div>

        <!-- Unlinked PRs -->
        <UTooltip
          v-for="pr in unlinkedPrs"
          :key="pr.number"
          :text="`#${pr.number} ${pr.title} (${pr.actor})`"
        >
          <a
            :href="pr.url"
            target="_blank"
            class="inline-flex items-center gap-1 rounded-full border border-default bg-elevated/50 px-2 py-0.5 text-xs hover:border-primary/50 transition-colors"
          >
            <UIcon
              :name="prStateIcon(pr.state)"
              class="size-3.5"
              :class="prStateColor(pr.state)"
            />
            <span class="text-muted">#{{ pr.number }}</span>
          </a>
        </UTooltip>
      </div>

      <!-- Right: Claims + Branch + Claim button -->
      <IssueClaimFlow
        :issue="issue"
        :repo="repo"
      />
    </div>

    <!-- Row 3: Labels, Milestone, Timestamps -->
    <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 border-t border-accented text-xs flex-wrap">
      <!-- Labels -->
      <UBadge
        v-for="label in issue.labels"
        :key="label.name"
        variant="subtle"
        size="xs"
        :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
      >
        {{ label.name }}
      </UBadge>

      <!-- Milestone -->
      <span
        v-if="issue.milestone"
        class="inline-flex items-center gap-1 text-muted"
      >
        <UIcon
          name="i-lucide-milestone"
          class="size-3.5"
        />
        {{ issue.milestone }}
      </span>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Timestamps + comment count -->
      <span class="text-muted">{{ createdAgo }}</span>
      <span class="text-muted/60 hidden sm:inline">&middot;</span>
      <span class="text-muted hidden sm:inline">{{ updatedAgo }}</span>
      <span
        v-if="commentCount > 0"
        class="inline-flex items-center gap-1 text-muted"
      >
        <UIcon
          name="i-lucide-message-square"
          class="size-3.5"
        />
        {{ commentCount }}
      </span>
    </div>
  </div>
</template>
