<script lang="ts" setup>
import type { IssueDetail } from '~~/shared/types/issue-detail'
import type { BranchStatus } from '~~/server/api/issues/branch-status.get'
import type { ClaimResult } from '~~/server/api/issues/claim.post'

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
const apiFetch = useRequestFetch()
const { user } = useUserSession()

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

// --- Claim Dialog ---

const { launch: rocketBlast } = useRocketBlast()
const claimOpen = ref(false)
const branchName = ref('')
const branchStatus = ref<BranchStatus | null>(null)
const claimResult = ref<ClaimResult | null>(null)
const loading = ref(false)
const checking = ref(false)
const error = ref('')
const initialCheckDone = ref(false)

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

const suggestedBranch = computed(() => `issue-${props.issue.number}-${slugify(props.issue.title)}`)

// Check branch status on mount
async function checkBranchStatus(branch?: string) {
  checking.value = true
  try {
    branchStatus.value = await apiFetch<BranchStatus>('/api/issues/branch-status', {
      params: { repo: props.repo, number: props.issue.number, branch: branch ?? suggestedBranch.value },
    })
  }
  catch { /* ignore */ }
  finally {
    checking.value = false
    initialCheckDone.value = true
  }
}

onMounted(() => checkBranchStatus())

// Claims: current user + others
const myClaim = computed(() => {
  if (!user.value || !branchStatus.value) return null
  return branchStatus.value.claims.find(c => c.login === user.value!.login) ?? null
})
const otherClaims = computed(() => {
  if (!user.value || !branchStatus.value) return []
  return branchStatus.value.claims.filter(c => c.login !== user.value!.login)
})

const cloneCommand = computed(() => {
  if (!myClaim.value || !branchStatus.value?.cloneUrl) return ''
  const branch = myClaim.value.branchName
  return branchStatus.value.isCollaborator
    ? `git fetch origin && git checkout ${branch}`
    : `git clone ${branchStatus.value.cloneUrl} && cd ${props.repo.split('/')[1]} && git checkout ${branch}`
})

async function openClaimDialog() {
  claimOpen.value = true
  claimResult.value = null
  error.value = ''
  branchName.value = suggestedBranch.value
  await checkBranchStatus()
}

// Re-check when branch name changes in dialog
let checkTimeout: ReturnType<typeof setTimeout>
function onBranchNameChange() {
  clearTimeout(checkTimeout)
  if (!branchName.value) return
  checkTimeout = setTimeout(() => checkBranchStatus(branchName.value), 500)
}

const claimDescription = computed(() => {
  if (!branchStatus.value) return ''
  if (branchStatus.value.isCollaborator) return t('issues.detail.claimDescCollab')
  if (branchStatus.value.hasFork) return t('issues.detail.claimDescBranch')
  return t('issues.detail.claimDescFork')
})

async function claim() {
  loading.value = true
  error.value = ''

  try {
    claimResult.value = await apiFetch<ClaimResult>('/api/issues/claim', {
      method: 'POST',
      body: { repo: props.repo, number: props.issue.number, branchName: branchName.value },
    })
    toast.add({
      title: t('issues.detail.claimSuccess'),
      description: claimResult.value.forked
        ? t('issues.detail.claimSuccessForked')
        : t('issues.detail.claimSuccessBranch'),
      color: 'success',
    })
    rocketBlast()
    // Refresh branch status so header shows branch info
    await checkBranchStatus(branchName.value)
  }
  catch (err: unknown) {
    const e = err as { statusCode?: number }
    if (e.statusCode === 409) {
      error.value = t('issues.detail.branchExists')
    }
    else if (e.statusCode === 504) {
      error.value = t('issues.detail.forkTimeout')
    }
    else {
      error.value = t('issues.detail.claimError')
    }
  }
  finally {
    loading.value = false
  }
}

function copyCommand() {
  const text = claimResult.value?.command || cloneCommand.value
  if (text) {
    navigator.clipboard.writeText(text)
    toast.add({ title: t('issues.detail.commandCopied'), color: 'success' })
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

      <!-- Right: Claims + Branch + Button -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Others working on this (avatar stack) -->
        <div
          v-if="initialCheckDone && otherClaims.length > 0"
          class="flex items-center gap-1.5"
        >
          <div class="flex -space-x-1.5">
            <UTooltip
              v-for="worker in otherClaims"
              :key="worker.login"
              :text="`${worker.login} · ${worker.branchName}`"
            >
              <UAvatar
                :src="`https://github.com/${worker.login}.png?size=32`"
                :alt="worker.login"
                size="2xs"
                class="ring-2 ring-default"
              />
            </UTooltip>
          </div>
          <span class="text-xs text-muted hidden sm:inline">{{ t('issues.detail.othersWorking', { count: otherClaims.length }) }}</span>
        </div>

        <!-- My branch chip -->
        <div
          v-if="initialCheckDone && myClaim && branchStatus?.branchExists"
          class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 pl-2.5 pr-1 py-0.5"
        >
          <UIcon
            name="i-lucide-git-branch"
            class="size-3.5 text-emerald-500"
          />
          <span class="font-mono text-xs text-muted max-w-32 sm:max-w-48 truncate">{{ myClaim.branchName }}</span>
          <UButton
            icon="i-lucide-copy"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="copyCommand"
          />
        </div>

        <!-- Claim button -->
        <UButton
          v-if="issue.state === 'OPEN' && initialCheckDone && !myClaim"
          :label="t('issues.detail.claim')"
          icon="i-lucide-hand"
          size="xs"
          variant="soft"
          @click="openClaimDialog"
        />
      </div>
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

  <!-- Claim Dialog -->
  <UModal
    v-model:open="claimOpen"
    :dismissible="!loading"
  >
    <template #content>
      <div class="p-6 space-y-4 min-w-md">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ t('issues.detail.claimTitle') }}
        </h2>

        <!-- Loading status check -->
        <div
          v-if="checking"
          class="text-sm text-muted"
        >
          {{ t('common.loading') }}
        </div>

        <!-- Status known, not yet claimed -->
        <template v-else-if="!claimResult">
          <p class="text-sm text-muted">
            {{ claimDescription }}
          </p>

          <!-- Others already working warning -->
          <UAlert
            v-if="branchStatus && branchStatus.claims.length > 0"
            icon="i-lucide-users"
            color="info"
            variant="subtle"
            :title="t('issues.detail.othersAlreadyWorking', { count: branchStatus.claims.length })"
          />

          <!-- Branch name input -->
          <UFormField :label="t('issues.detail.branchName')">
            <UInput
              v-model="branchName"
              class="font-mono w-full"
              size="lg"
              @update:model-value="onBranchNameChange"
            />
          </UFormField>

          <!-- Branch exists warning -->
          <UAlert
            v-if="branchStatus?.branchExists"
            icon="i-lucide-alert-triangle"
            color="warning"
            variant="subtle"
            :title="t('issues.detail.branchExists')"
            :description="t('issues.detail.branchExistsHint')"
          />

          <!-- Error -->
          <UAlert
            v-if="error"
            icon="i-lucide-circle-x"
            color="error"
            variant="subtle"
            :title="error"
          />

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              v-if="!loading"
              :label="t('profile.cancel')"
              variant="ghost"
              color="neutral"
              @click="claimOpen = false"
            />
            <UButton
              v-if="branchStatus?.branchExists"
              :label="t('issues.detail.useExisting')"
              variant="soft"
              color="neutral"
              @click="claimOpen = false"
            />
            <UButton
              :label="loading ? t('issues.detail.claiming') : t('issues.detail.letsGo')"
              icon="i-lucide-rocket"
              :loading="loading"
              :disabled="loading || !branchName || branchStatus?.branchExists"
              @click="claim"
            />
          </div>
        </template>

        <!-- Success: show command -->
        <template v-else>
          <UAlert
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
            :title="t('issues.detail.claimSuccess')"
            :description="claimResult.forked ? t('issues.detail.claimSuccessForked') : t('issues.detail.claimSuccessBranch')"
          />

          <div class="relative group rounded-lg bg-elevated p-3 pr-10 font-mono text-sm break-all">
            {{ claimResult.command }}
            <UButton
              icon="i-lucide-copy"
              variant="ghost"
              color="neutral"
              size="xs"
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              @click="copyCommand"
            />
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              :label="t('issues.detail.copyCommand')"
              icon="i-lucide-copy"
              variant="soft"
              @click="copyCommand"
            />
            <UButton
              label="OK"
              @click="claimOpen = false"
            />
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
