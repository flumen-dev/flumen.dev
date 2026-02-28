<script lang="ts" setup>
import type { CheckRunDetail } from '~~/shared/types/check-run'
import type { IssueDetail } from '~~/shared/types/issue-detail'
import type { WorkItemDetail } from '~~/shared/types/work-item'
import { formatDuration, getCIIcon, getIssueStateColor, getIssueStateIcon, getPRStateColor, getPRStateIcon } from '~/utils/prMeta'

const props = defineProps<{
  workItem: WorkItemDetail
  repo: string
  issue?: IssueDetail | null
}>()

const { t } = useI18n()
const toast = useToast()
const { open: openProfile } = useUserProfileDialog()

const createdAgo = useTimeAgo(computed(() => props.workItem.createdAt))
const updatedAgo = useTimeAgo(computed(() => props.workItem.updatedAt))

// --- PR numbers for CI checks ---

const prNumbers = computed<number[]>(() => {
  const wi = props.workItem
  if (wi.primaryType === 'pull') {
    return [wi.number]
  }
  return wi.linkedPulls
    .filter(p => !p.state || p.state === 'OPEN')
    .map(p => p.number)
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

const ciMeta = computed(() => getCIIcon(checkResult.value?.rollupStatus) ?? { name: 'i-lucide-circle-dashed', color: 'text-muted' })

const ciSummary = computed(() => {
  if (!checkResult.value) return ''
  const r = checkResult.value
  if (r.rollupStatus === 'SUCCESS' && r.total > 0) return t('workItems.ci.allPassed')
  const parts: string[] = []
  if (r.failed > 0) parts.push(t('workItems.ci.failedCount', { count: r.failed }))
  if (r.pending > 0) parts.push(t('workItems.ci.pending', { count: r.pending }))
  if (r.passed > 0) parts.push(t('workItems.ci.passedCount', { count: r.passed }))
  return parts.join(' \u00b7 ')
})
</script>

<template>
  <div class="sticky top-0 z-10 border border-default rounded-xl sm:rounded-2xl bg-elevated/95 shadow-sm backdrop-blur">
    <!-- Row 1: State + Title + Actions -->
    <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
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

    <!-- Row 2: Assignment Zone -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3 px-3 sm:px-4 py-2 border-t border-accented">
      <!-- Left: Assignees + PRs -->
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-0">
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
      </div>

      <!-- Right: Claims (only when issue detail is available) -->
      <IssueClaimFlow
        v-if="issue"
        :issue="issue"
        :repo="repo"
      />
    </div>

    <!-- Row 3: Labels, Milestone, Timestamps -->
    <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 border-t border-accented text-xs flex-wrap">
      <!-- Labels -->
      <UBadge
        v-for="label in workItem.labels"
        :key="label.name"
        variant="subtle"
        size="xs"
        :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
      >
        {{ label.name }}
      </UBadge>

      <!-- Spacer -->
      <div class="flex-1" />

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
      <!-- Summary bar (always visible) -->
      <button
        type="button"
        class="flex items-center gap-2 w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs hover:bg-elevated/50 transition-colors"
        :aria-label="t('workItems.ci.checks')"
        :aria-expanded="ciExpanded"
        @click="ciExpanded = !ciExpanded"
      >
        <UIcon
          :name="ciMeta.name"
          class="size-3.5 shrink-0"
          :class="[ciMeta.color, ciMeta.spin ? 'animate-spin' : '']"
        />
        <span class="text-muted truncate">{{ ciSummary }}</span>
        <UIcon
          :name="ciExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-3.5 text-muted shrink-0 ml-auto"
        />
      </button>

      <!-- Expanded: categorized, scrollable -->
      <div
        v-if="ciExpanded && checkResult"
        class="max-h-48 overflow-y-auto px-3 sm:px-4 pb-2 space-y-2"
      >
        <!-- Failed -->
        <div v-if="failedChecks.length">
          <button
            type="button"
            class="flex items-center gap-2 w-full text-[11px] font-medium text-red-500 uppercase tracking-wide mb-1 hover:text-red-400 transition-colors cursor-pointer"
            @click="failedExpanded = !failedExpanded"
          >
            <UIcon
              :name="failedExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-3 shrink-0"
            />
            {{ t('workItems.ci.failedCount', { count: failedChecks.length }) }}
          </button>
          <template v-if="failedExpanded">
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
        </div>

        <!-- Running -->
        <div v-if="pendingChecks.length">
          <p class="text-[11px] font-medium text-amber-500 uppercase tracking-wide mb-1">
            {{ t('workItems.ci.pending', { count: pendingChecks.length }) }}
          </p>
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
        </div>

        <!-- Passed (collapsed by default) -->
        <div v-if="passedChecks.length">
          <button
            type="button"
            class="flex items-center gap-2 w-full text-[11px] font-medium text-emerald-500 uppercase tracking-wide mb-1 hover:text-emerald-400 transition-colors cursor-pointer"
            @click="passedExpanded = !passedExpanded"
          >
            <UIcon
              :name="passedExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-3 shrink-0"
            />
            {{ t('workItems.ci.passedCount', { count: passedChecks.length }) }}
          </button>
          <template v-if="passedExpanded">
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
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- CI Log Dialog -->
    <WorkItemCiLogDialog
      v-model:open="logDialogOpen"
      :check="logDialogCheck"
      :owner="ownerRef"
      :repo="repoRef"
    />
  </div>
</template>
