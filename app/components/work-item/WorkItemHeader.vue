<script lang="ts" setup>
import type { CheckRunDetail } from '~~/shared/types/check-run'
import type { WorkItemDetail } from '~~/shared/types/work-item'
import { formatDuration, getCIIcon, getIssueStateColor, getIssueStateIcon, getPRStateColor, getPRStateIcon } from '~/utils/prMeta'

const props = defineProps<{
  workItem: WorkItemDetail
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const { open: openProfile } = useUserProfileDialog()

// Fetch issue detail for ClaimFlow (deduplicates via useAsyncData key)
const isIssuePrimary = computed(() => props.workItem.primaryType === 'issue')
const issueNumber = computed(() => isIssuePrimary.value ? props.workItem.number : undefined)
const repo = computed(() => props.repo)
const { issue } = useIssueDetail(repo, issueNumber)

const createdAgo = useTimeAgo(computed(() => props.workItem.createdAt))
const updatedAgo = useTimeAgo(computed(() => props.workItem.updatedAt))

// --- PR numbers for CI checks ---

const prNumbers = computed<number[]>(() => {
  const wi = props.workItem
  if (wi.primaryType === 'pull') {
    return [wi.number]
  }
  const fromLinked = wi.linkedPulls
    .filter(p => !p.state || p.state === 'OPEN')
    .map(p => p.number)
  const fromContributions = (wi as WorkItemDetail).contributions
    ?.filter(c => c.state === 'OPEN')
    .map(c => c.number) ?? []
  return [...new Set([...fromLinked, ...fromContributions])]
})

const [ownerRef, repoRef] = (() => {
  const parts = props.repo.split('/')
  return [
    computed(() => parts[0] ?? ''),
    computed(() => parts[1] ?? ''),
  ]
})()

const emit = defineEmits<{
  ciStatusChanged: []
  merged: []
  reviewed: []
}>()

const { result: checkResult, statusChanged } = useCheckRuns(ownerRef, repoRef, prNumbers)
const ciExpanded = ref(false)

watch(statusChanged, () => {
  emit('ciStatusChanged')
})

// --- Row 1: State ---

const stateIcon = computed(() => {
  const wi = props.workItem
  if (wi.primaryType === 'pull') return getPRStateIcon(wi.state, wi.isDraft)
  return getIssueStateIcon(wi.state)
})

const stateColor = computed(() => {
  const wi = props.workItem
  if (wi.primaryType === 'pull') return getPRStateColor(wi.state, wi.isDraft)
  return getIssueStateColor(wi.state)
})

const stateBg = computed(() => stateColor.value.replace('text-', 'bg-') + '/10')

const stateLabel = computed(() => {
  const wi = props.workItem
  if (wi.primaryType === 'pull') {
    if (wi.state === 'MERGED') return t('repos.workItem.state.merged')
    if (wi.state === 'CLOSED') return t('repos.workItem.state.closed')
    if (wi.state === 'DRAFT') return t('repos.workItem.state.draft')
    return t('repos.workItem.state.open')
  }
  if (wi.state === 'OPEN') return t('issues.open')
  return t('issues.closedAs')
})

function copyLink() {
  navigator.clipboard.writeText(props.workItem.url)
  toast.add({ title: t('common.copied'), color: 'success' })
}

// --- Row 2: Assignees + PRs ---

const linkedPrs = computed(() =>
  props.workItem.linkedPulls.map(p => ({
    number: p.number,
    title: p.title,
    url: p.htmlUrl,
    state: p.state ?? '',
    isDraft: p.isDraft ?? false,
  })),
)

// --- Row 4: CI ---

const failedChecks = computed(() => checkResult.value?.checks.filter(c => c.status === 'FAILURE') ?? [])
const pendingChecks = computed(() => checkResult.value?.checks.filter(c => c.status === 'PENDING') ?? [])
const passedChecks = computed(() => checkResult.value?.checks.filter(c => c.status === 'SUCCESS') ?? [])

const failedExpanded = ref(true)
const passedExpanded = ref(false)

// --- Log dialog ---
const logDialogOpen = ref(false)
const logDialogCheck = ref<CheckRunDetail | null>(null)

function openLogDialog(check: CheckRunDetail) {
  logDialogCheck.value = check
  logDialogOpen.value = true
}

// --- Row 5: Merge ---

const mergeExpanded = ref(false)
const mergeStrategy = ref<'merge' | 'squash' | 'rebase'>('squash')
const mergeTitle = ref('')
const mergeMessage = ref('')
const merging = ref(false)
const justMerged = ref(false)
const branchDeleted = ref(false)
const deletingBranch = ref(false)

watch(() => props.workItem.id, () => {
  branchDeleted.value = false
  deletingBranch.value = false
  justMerged.value = false
})

const headBranch = computed(() => props.workItem.headBranch ?? mergeStatus.value?.headBranch ?? null)
const isForkBranch = computed(() => {
  const headRepo = props.workItem.headBranchRepo
  return !!headRepo && headRepo !== props.repo
})
const showDeleteBranch = computed(() =>
  (justMerged.value || props.workItem.state === 'MERGED')
  && headBranch.value
  && !branchDeleted.value
  && !isForkBranch.value,
)

const isPR = computed(() => props.workItem.primaryType === 'pull')
const hasPr = inject<Ref<boolean>>('hasPr', computed(() => isPR.value || props.workItem.contributions.length > 0))
const activePr = computed(() => {
  if (isPR.value) return { number: props.workItem.number, state: props.workItem.state }
  const contribution = props.workItem.contributions[0]
  return contribution ? { number: contribution.number, state: contribution.state } : null
})
const isPRNotClosed = computed(() => hasPr.value && activePr.value && activePr.value.state !== 'MERGED' && activePr.value.state !== 'CLOSED' && !justMerged.value)
const isPROpen = computed(() => isPRNotClosed.value && activePr.value?.state === 'OPEN')
const mergeNumber = computed(() => isPROpen.value && activePr.value ? activePr.value.number : null)
const { status: mergeStatus, loading: mergeLoading, error: mergeError, fetch: fetchMergeStatus, merge: executeMerge } = useMergeStatus(ownerRef, repoRef, mergeNumber)

// Lazy fetch: only when expanded for the first time
watch(mergeExpanded, (expanded) => {
  if (expanded && !mergeStatus.value && !mergeLoading.value) {
    fetchMergeStatus()
  }
})

// Sync defaults from API when loaded
watch(mergeStatus, (ms) => {
  if (!ms) return
  mergeStrategy.value = ms.defaultStrategy
  if (!mergeTitle.value) mergeTitle.value = ms.defaultTitle
})

const KNOWN_STRATEGIES = new Set<string>(['merge', 'squash', 'rebase'])

const mergeStrategies = computed(() => {
  const allowed = (mergeStatus.value?.allowedStrategies ?? ['merge', 'squash', 'rebase']).filter(v => KNOWN_STRATEGIES.has(v))
  const count = mergeStatus.value?.commitCount ?? 0
  return allowed.map((value) => {
    switch (value) {
      case 'merge': return { value, label: t('workItems.merge.keepAll'), desc: t('workItems.merge.keepAllDesc', { count }), techName: 'merge commit', icon: 'i-lucide-git-merge' }
      case 'squash': return { value, label: t('workItems.merge.combineIntoOne'), desc: t('workItems.merge.combineIntoOneDesc', { count }), techName: 'squash', icon: 'i-lucide-git-commit-horizontal' }
      case 'rebase': return { value, label: t('workItems.merge.replayOnTop'), desc: t('workItems.merge.replayOnTopDesc', { count }), techName: 'rebase', icon: 'i-lucide-git-branch' }
      default: return { value, label: value, desc: '', techName: value, icon: 'i-lucide-git-merge' }
    }
  })
})

const activeStrategy = computed(() => mergeStrategies.value.find(s => s.value === mergeStrategy.value) ?? mergeStrategies.value[0])
const showCommitFields = computed(() => mergeStrategy.value !== 'rebase')
const canMerge = computed(() => mergeStatus.value?.canMerge === true)
const canBypassRules = computed(() => !canMerge.value && mergeStatus.value?.canBypassRules === true)

async function handleMerge() {
  if ((!canMerge.value && !canBypassRules.value) || merging.value) return
  merging.value = true
  try {
    await executeMerge(
      mergeStrategy.value,
      mergeStrategy.value !== 'rebase' ? mergeTitle.value : undefined,
      mergeStrategy.value !== 'rebase' ? mergeMessage.value : undefined,
      mergeStatus.value?.headSha,
    )
    justMerged.value = true
    toast.add({ title: t('workItems.merge.mergeSuccess'), color: 'success' })
    emit('merged')
  }
  catch (e: unknown) {
    const fetchErr = e as { data?: { data?: { errorKey?: string } } }
    const errorKey = fetchErr.data?.data?.errorKey ?? 'unknown'
    toast.add({
      title: t('workItems.merge.mergeFailed'),
      description: t(`workItems.merge.error.${errorKey}`),
      color: 'error',
    })
  }
  finally {
    merging.value = false
  }
}

async function handleDeleteBranch() {
  if (!headBranch.value || deletingBranch.value) return
  deletingBranch.value = true
  try {
    await $fetch(
      `/api/repository/${ownerRef.value}/${repoRef.value}/pulls/${props.workItem.number}/delete-branch`,
      { method: 'POST', body: { branch: headBranch.value, repo: props.workItem.headBranchRepo } },
    )
    branchDeleted.value = true
    toast.add({ title: t('workItems.merge.branchDeleted'), color: 'success' })
  }
  catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? ''
    toast.add({ title: t('workItems.merge.branchDeleteFailed'), description: msg, color: 'error' })
  }
  finally {
    deletingBranch.value = false
  }
}
</script>

<template>
  <div class="sticky -top-4 sm:-top-6 z-20 bg-elevated/95 backdrop-blur -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
    <!-- Row 1: State + Title + Actions -->
    <div
      class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-default/60 border-b-2"
      :class="stateColor.replace('text-', 'border-')"
    >
      <UTooltip :text="stateLabel">
        <span
          class="inline-flex items-center justify-center size-7 rounded-full shrink-0"
          :class="stateBg"
        >
          <UIcon
            :name="stateIcon"
            class="size-4"
            :class="stateColor"
          />
        </span>
      </UTooltip>

      <h1 class="flex-1 min-w-0 text-base sm:text-lg font-semibold text-highlighted truncate">
        {{ workItem.title }}
      </h1>

      <span class="font-mono text-muted text-xs sm:text-sm shrink-0">#{{ workItem.number }}</span>

      <div class="flex items-center gap-0.5 shrink-0">
        <UTooltip :text="t('common.copyLink')">
          <UButton
            icon="i-lucide-link"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('common.copyLink')"
            @click="copyLink"
          />
        </UTooltip>
        <UTooltip :text="t('common.viewOnGithub')">
          <UButton
            icon="i-lucide-external-link"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('common.viewOnGithub')"
            :to="workItem.url"
            target="_blank"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Row 2: Assignees, Labels, Timestamps -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3 px-3 sm:px-4 py-1.5 sm:py-2 border-t border-accented text-xs">
      <!-- No assignees -->
      <UBadge
        v-if="workItem.assignees.length === 0"
        :label="t('issues.detail.needsOwner')"
        color="warning"
        variant="subtle"
        icon="i-lucide-user-x"
      />

      <!-- Assignees -->
      <div
        v-for="assignee in workItem.assignees"
        :key="assignee.login"
        class="flex items-center gap-1.5"
      >
        <button
          type="button"
          class="inline-flex items-center gap-1.5 cursor-pointer hover:underline"
          @click="openProfile(assignee.login)"
        >
          <UAvatar
            :src="assignee.avatarUrl"
            :alt="assignee.login"
            size="2xs"
          />
          <span class="text-sm font-medium text-highlighted hidden sm:inline">{{ assignee.login }}</span>
        </button>
      </div>

      <!-- Linked PRs -->
      <UTooltip
        v-for="pr in linkedPrs"
        :key="pr.number"
        :text="`#${pr.number} ${pr.title}`"
      >
        <a
          :href="pr.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-full border border-default bg-elevated/50 px-2 py-0.5 text-xs hover:border-primary/50 transition-colors"
        >
          <UIcon
            :name="getPRStateIcon(pr.state, pr.isDraft)"
            class="size-3.5"
            :class="getPRStateColor(pr.state, pr.isDraft)"
          />
          <span class="text-muted">#{{ pr.number }}</span>
        </a>
      </UTooltip>

      <!-- Labels -->
      <UBadge
        v-for="label in workItem.labels"
        :key="label.name"
        variant="subtle"
        size="sm"
        :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
      >
        {{ label.name }}
      </UBadge>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Claims -->
      <IssueClaimFlow
        v-if="issue"
        :issue="issue"
        :repo="repo"
      />

      <!-- Timestamps + comment count -->
      <span class="text-muted">{{ createdAgo }}</span>
      <span class="text-muted/60 hidden sm:inline">&middot;</span>
      <span class="text-muted hidden sm:inline">{{ updatedAgo }}</span>
      <span
        v-if="workItem.commentCount > 0"
        class="inline-flex items-center gap-1 text-muted"
      >
        <UIcon
          name="i-lucide-message-square"
          class="size-3.5"
        />
        {{ workItem.commentCount }}
      </span>
    </div>

    <!-- Row 4: CI Checks -->
    <div
      v-if="prNumbers.length > 0"
      class="border-t border-accented"
    >
      <!-- Summary bar: category badges side by side -->
      <div class="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 flex-wrap">
        <!-- Failed -->
        <button
          v-if="failedChecks.length"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer"
          :class="ciExpanded && failedExpanded ? 'bg-red-500/15 text-red-500' : 'bg-red-500/10 text-red-500/80 hover:bg-red-500/15 hover:text-red-500'"
          @click="ciExpanded ? failedExpanded = !failedExpanded : (ciExpanded = true, failedExpanded = true)"
        >
          <UIcon
            :name="getCIIcon('FAILURE')!.name"
            class="size-3.5"
          />
          {{ failedChecks.length }}
          {{ t('workItems.ci.failed') }}
        </button>

        <!-- Pending -->
        <button
          v-if="pendingChecks.length"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer"
          :class="ciExpanded ? 'bg-amber-500/15 text-amber-500' : 'bg-amber-500/10 text-amber-500/80 hover:bg-amber-500/15 hover:text-amber-500'"
          @click="ciExpanded = !ciExpanded"
        >
          <UIcon
            :name="getCIIcon('PENDING')!.name"
            class="size-3.5 animate-spin"
          />
          {{ pendingChecks.length }}
          {{ t('workItems.ci.running') }}
        </button>

        <!-- Passed -->
        <button
          v-if="passedChecks.length"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer"
          :class="ciExpanded && passedExpanded ? 'bg-emerald-500/15 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500/80 hover:bg-emerald-500/15 hover:text-emerald-500'"
          @click="ciExpanded = true; passedExpanded = !passedExpanded"
        >
          <UIcon
            :name="getCIIcon('SUCCESS')!.name"
            class="size-3.5"
          />
          {{ passedChecks.length }}
          {{ t('workItems.ci.passed') }}
        </button>

        <!-- All passed (no failures/pending) -->
        <span
          v-if="checkResult && !failedChecks.length && !pendingChecks.length && passedChecks.length"
          class="text-xs text-emerald-500"
        >
          {{ t('workItems.ci.allPassed') }}
        </span>

        <!-- Loading -->
        <span
          v-if="!checkResult"
          class="text-xs text-muted"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="size-3.5 animate-spin align-text-bottom"
          />
        </span>
      </div>

      <!-- Expanded: check details -->
      <div
        v-if="ciExpanded && checkResult"
        class="max-h-48 overflow-y-auto px-3 sm:px-4 pb-2 space-y-1.5"
      >
        <!-- Failed checks -->
        <template v-if="failedExpanded && failedChecks.length">
          <div
            v-for="check in failedChecks"
            :key="check.name"
            class="flex items-center gap-2 text-xs py-0.5"
          >
            <UIcon
              :name="getCIIcon('FAILURE')!.name"
              class="size-3.5 shrink-0"
              :class="getCIIcon('FAILURE')!.color"
            />
            <button
              class="truncate flex-1 text-highlighted text-left hover:underline cursor-pointer"
              @click="openLogDialog(check)"
            >
              {{ check.name }}
            </button>
            <span
              v-if="check.durationSeconds !== null"
              class="text-muted shrink-0"
            >{{ formatDuration(check.durationSeconds) }}</span>
            <button
              v-if="check.jobId"
              class="text-primary hover:underline shrink-0 cursor-pointer"
              @click="openLogDialog(check)"
            >
              {{ t('workItems.ci.viewLog') }}
            </button>
            <a
              v-else-if="check.detailsUrl"
              :href="check.detailsUrl"
              target="_blank"
              class="text-primary hover:underline shrink-0"
            >{{ t('workItems.ci.viewLog') }}</a>
          </div>
        </template>

        <!-- Pending checks -->
        <template v-if="pendingChecks.length">
          <div
            v-for="check in pendingChecks"
            :key="check.name"
            class="flex items-center gap-2 text-xs py-0.5"
          >
            <UIcon
              :name="getCIIcon('PENDING')!.name"
              class="size-3.5 shrink-0 animate-spin"
              :class="getCIIcon('PENDING')!.color"
            />
            <span class="truncate flex-1 text-highlighted">{{ check.name }}</span>
          </div>
        </template>

        <!-- Passed checks -->
        <template v-if="passedExpanded && passedChecks.length">
          <div
            v-for="check in passedChecks"
            :key="check.name"
            class="flex items-center gap-2 text-xs py-0.5"
          >
            <UIcon
              :name="getCIIcon('SUCCESS')!.name"
              class="size-3.5 shrink-0"
              :class="getCIIcon('SUCCESS')!.color"
            />
            <button
              class="truncate flex-1 text-muted text-left hover:underline cursor-pointer"
              @click="openLogDialog(check)"
            >
              {{ check.name }}
            </button>
            <span
              v-if="check.durationSeconds !== null"
              class="text-muted shrink-0"
            >{{ formatDuration(check.durationSeconds) }}</span>
            <button
              v-if="check.jobId"
              class="text-primary hover:underline shrink-0 cursor-pointer"
              @click="openLogDialog(check)"
            >
              {{ t('workItems.ci.viewLog') }}
            </button>
            <a
              v-else-if="check.detailsUrl"
              :href="check.detailsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline shrink-0"
            >{{ t('workItems.ci.viewLog') }}</a>
          </div>
        </template>
      </div>
    </div>

    <!-- Row 5: Review Actions (PR only, open) -->
    <WorkItemReviewActions
      v-if="isPRNotClosed && activePr"
      :reviewers="workItem.reviewers ?? []"
      :owner="ownerRef"
      :repo="repoRef"
      :pr-number="activePr?.number ?? workItem.number"
      :work-item-id="workItem.id"
      @reviewed="emit('reviewed')"
    />

    <!-- Row 6: Merge (PR only) -->
    <div
      v-if="hasPr"
      class="border-t border-accented bg-primary/5"
    >
      <!-- Already merged (locally or after refresh) -->
      <div
        v-if="justMerged || workItem.state === 'MERGED'"
        class="flex items-center gap-2 px-3 sm:px-4 py-2.5"
      >
        <UIcon
          name="i-lucide-git-merge"
          class="size-3.5 shrink-0 text-violet-500"
        />
        <span class="text-xs text-violet-500 font-medium flex-1">{{ t('workItems.merge.mergeSuccess') }}</span>

        <!-- Delete branch -->
        <UButton
          v-if="showDeleteBranch"
          :label="t('workItems.merge.deleteBranch')"
          icon="i-lucide-trash-2"
          size="xs"
          variant="soft"
          color="error"
          :loading="deletingBranch"
          :disabled="deletingBranch"
          class="shrink-0"
          @click="handleDeleteBranch"
        />
        <span
          v-else-if="branchDeleted"
          class="text-xs text-muted"
        >
          {{ t('workItems.merge.branchDeletedLabel') }}
        </span>
      </div>

      <!-- Open PR: merge controls -->
      <template v-else-if="isPROpen">
        <!-- Collapsed: summary + merge button -->
        <div class="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5">
          <button
            type="button"
            class="flex items-center gap-2 flex-1 min-w-0 text-xs hover:bg-elevated/50 rounded-md px-1 -mx-1 py-0.5 transition-colors"
            :aria-expanded="mergeExpanded"
            :aria-label="t('workItems.merge.merge')"
            @click="mergeExpanded = !mergeExpanded"
          >
            <UIcon
              name="i-lucide-git-merge"
              class="size-3.5 shrink-0"
              :class="canMerge ? 'text-emerald-500' : canBypassRules ? 'text-warning' : 'text-muted'"
            />
            <span class="text-muted truncate">
              {{ mergeLoading ? t('common.loading') : t('workItems.merge.readyToMerge') }}
            </span>
            <UIcon
              :name="mergeExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="size-3.5 text-muted shrink-0"
            />
          </button>
        </div>

        <!-- Expanded: strategy picker + commit message -->
        <div
          v-if="mergeExpanded"
          class="px-3 sm:px-4 pb-3 space-y-3"
        >
          <!-- Loading state -->
          <div
            v-if="mergeLoading"
            class="flex items-center justify-center py-4 text-muted text-xs"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="size-4 animate-spin mr-2"
            />
            {{ t('common.loading') }}
          </div>

          <!-- Error state -->
          <div
            v-else-if="mergeError"
            class="flex items-center gap-2 py-3 text-xs text-red-500"
          >
            <UIcon
              name="i-lucide-alert-circle"
              class="size-4 shrink-0"
            />
            <span>{{ mergeError }}</span>
            <button
              class="text-primary hover:underline ml-auto cursor-pointer"
              @click="fetchMergeStatus"
            >
              {{ t('common.retry') }}
            </button>
          </div>

          <template v-else-if="mergeStatus">
            <!-- Strategy picker + merge button -->
            <div class="flex items-center gap-2 flex-wrap">
              <div
                class="inline-flex rounded-md border border-default overflow-hidden"
                :class="merging ? 'opacity-50 pointer-events-none' : ''"
              >
                <UTooltip
                  v-for="strategy in mergeStrategies"
                  :key="strategy.value"
                  :text="strategy.label"
                >
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border-r border-default last:border-r-0"
                    :class="[
                      mergeStrategy === strategy.value
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted hover:text-highlighted hover:bg-elevated/50',
                    ]"
                    :disabled="merging"
                    @click="mergeStrategy = strategy.value"
                  >
                    <UIcon
                      :name="strategy.icon"
                      class="size-3.5"
                    />
                    {{ strategy.techName }}
                  </button>
                </UTooltip>
              </div>

              <span
                v-if="activeStrategy"
                class="text-xs text-muted"
              >
                {{ activeStrategy.desc }}
              </span>
            </div>

            <!-- Commit fields (not for rebase) -->
            <div
              v-if="showCommitFields"
              class="space-y-2 rounded-md border border-default bg-default/50 p-2.5 transition-opacity"
              :class="merging ? 'opacity-50 pointer-events-none' : ''"
            >
              <UInput
                v-model="mergeTitle"
                :placeholder="t('workItems.merge.commitTitle')"
                size="sm"
                variant="none"
                :disabled="merging"
                class="font-mono text-xs w-full"
              />
              <div class="border-t border-accented" />
              <UTextarea
                v-model="mergeMessage"
                :placeholder="t('workItems.merge.commitMessage')"
                size="sm"
                variant="none"
                :rows="2"
                :disabled="merging"
                autoresize
                class="font-mono text-xs w-full"
              />
            </div>

            <!-- Bypass hint -->
            <div
              v-if="canBypassRules"
              class="flex items-center gap-1.5 text-xs text-warning"
            >
              <UIcon
                name="i-lucide-shield-alert"
                class="size-3.5 shrink-0"
              />
              {{ t('workItems.merge.bypassHint') }}
            </div>

            <!-- Merge button -->
            <UButton
              :label="canBypassRules ? t('workItems.merge.mergeBypass') : t('workItems.merge.confirmMerge')"
              icon="i-lucide-git-merge"
              :color="canBypassRules ? 'warning' : 'primary'"
              block
              :disabled="(!canMerge && !canBypassRules) || merging"
              :loading="merging"
              size="sm"
              @click="handleMerge"
            />
          </template>
        </div>
      </template>
    </div>

    <!-- Inverted radius: content curves into the header -->
    <div class="h-2.5 bg-default rounded-t-xl" />

    <!-- CI Log Dialog -->
    <WorkItemCiLogDialog
      v-model:open="logDialogOpen"
      :check="logDialogCheck"
      :owner="ownerRef"
      :repo="repoRef"
    />
  </div>
</template>
