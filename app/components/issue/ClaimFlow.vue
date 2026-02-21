<script setup lang="ts">
import type { IssueDetail } from '~~/shared/types/issue-detail'
import type { BranchStatus } from '~~/server/api/issues/branch-status.get'
import type { ClaimResult } from '~~/server/api/issues/claim.post'
import { suggestBranchName } from '~~/shared/utils/branch'

const props = defineProps<{
  issue: IssueDetail
  repo: string
}>()

const emit = defineEmits<{
  claimed: []
}>()

const { t } = useI18n()
const toast = useToast()
const apiFetch = useRequestFetch()
const { user } = useUserSession()
const { launch: rocketBlast } = useRocketBlast()
const cliBridge = useCliBridgeStore()

// --- State ---
const dialogOpen = ref(false)
const branchName = ref('')
const branchStatus = ref<BranchStatus | null>(null)
const claimResult = ref<ClaimResult | null>(null)
const loading = ref(false)
const checking = ref(false)
const checkoutLoading = ref(false)
const checkoutResult = ref<{ status: string, message: string } | null>(null)
const error = ref('')
const initialCheckDone = ref(false)
const pushing = ref(false)
const pushDialogOpen = ref(false)
const prTitle = ref('')

const suggestedBranch = computed(() => suggestBranchName(props.issue.number, props.issue.title))

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

// Debounced re-check when branch name changes
let checkTimeout: ReturnType<typeof setTimeout>
function onBranchNameChange() {
  clearTimeout(checkTimeout)
  if (!branchName.value) return
  checkTimeout = setTimeout(() => checkBranchStatus(branchName.value), 500)
}
onBeforeUnmount(() => clearTimeout(checkTimeout))

// --- Computed ---

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

const needsPush = computed(() =>
  cliBridge.pushState === 'has_commits' || cliBridge.pushState === 'first_push',
)

const claimDescription = computed(() => {
  if (!branchStatus.value) return ''
  if (branchStatus.value.isCollaborator) return t('issues.detail.claimDescCollab')
  if (branchStatus.value.hasFork) return t('issues.detail.claimDescBranch')
  return t('issues.detail.claimDescFork')
})

// --- Actions ---

function openDialog() {
  dialogOpen.value = true
  claimResult.value = null
  checkoutResult.value = null
  error.value = ''
  branchName.value = suggestedBranch.value
  checkBranchStatus()
}

async function claim() {
  loading.value = true
  error.value = ''

  try {
    claimResult.value = await apiFetch<ClaimResult>('/api/issues/claim', {
      method: 'POST',
      body: { repo: props.repo, number: props.issue.number, branchName: branchName.value },
    })
    rocketBlast()

    // If CLI connected → auto-checkout locally
    if (cliBridge.connected) {
      checkoutLoading.value = true
      checkoutResult.value = await cliBridge.checkout(branchName.value, props.repo)
      checkoutLoading.value = false

      if (checkoutResult.value?.status === 'ok') {
        console.info(`[flumli] ✓ Checked out ${branchName.value}`)
      }
      else {
        console.warn(`[flumli] ✗ Checkout failed:`, checkoutResult.value?.message)
      }
    }

    toast.add({
      title: t('issues.detail.claimSuccess'),
      description: claimResult.value.forked
        ? t('issues.detail.claimSuccessForked')
        : t('issues.detail.claimSuccessBranch'),
      color: 'success',
    })

    await checkBranchStatus(branchName.value)
    emit('claimed')
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

async function retryCheckout() {
  if (!claimResult.value) return
  checkoutLoading.value = true
  checkoutResult.value = await cliBridge.checkout(claimResult.value.branchName, props.repo)
  checkoutLoading.value = false
}

// Fetch push state when we have a claim and CLI is connected
watch(
  [myClaim, () => cliBridge.connected],
  ([claim, conn]) => {
    if (claim && conn) cliBridge.fetchPushState()
  },
)

function openPushDialog() {
  prTitle.value = props.issue.title
  pushDialogOpen.value = true
}

async function doPush(withPr: boolean) {
  pushing.value = true
  const opts = withPr
    ? { title: prTitle.value, issueNumber: props.issue.number }
    : undefined
  const result = await cliBridge.push(opts)
  pushing.value = false

  if (!result || result.status === 'error') {
    toast.add({
      title: t('cli.pushFailed'),
      description: result?.status === 'error' ? result.message : undefined,
      color: 'error',
    })
  }
  else if (result.status === 'pushed_with_pr' || result.status === 'created_pr') {
    toast.add({ title: t('cli.pushWithPr'), color: 'success' })
    pushDialogOpen.value = false
  }
  else if (result.status === 'pushed') {
    toast.add({ title: t('cli.pushed'), color: 'success' })
    pushDialogOpen.value = false
  }
  else {
    toast.add({ title: t('cli.nothingToPush'), color: 'info' })
    pushDialogOpen.value = false
  }

  // Refresh push state
  await cliBridge.fetchPushState()
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
  <!-- Inline: others working + branch chip + claim button -->
  <div class="flex items-center gap-2 shrink-0">
    <!-- Others working (avatar stack) -->
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

    <!-- Push / Create PR buttons (CLI connected + claimed) -->
    <template v-if="initialCheckDone && myClaim && cliBridge.connected">
      <!-- Has unpushed commits + PR exists → just push -->
      <UButton
        v-if="(cliBridge.pushState === 'has_commits' || cliBridge.pushState === 'first_push') && cliBridge.hasPr"
        :label="t('cli.push')"
        icon="i-lucide-arrow-up"
        size="xs"
        variant="soft"
        :loading="pushing"
        @click="doPush(false)"
      />
      <!-- No PR yet → Create PR (will also push if needed) -->
      <UButton
        v-if="!cliBridge.hasPr && cliBridge.pushState !== null"
        :label="t('cli.createPr')"
        icon="i-lucide-git-pull-request-arrow"
        size="xs"
        variant="soft"
        color="primary"
        :loading="pushing"
        @click="openPushDialog"
      />
      <!-- PR exists → link to it -->
      <UButton
        v-if="cliBridge.hasPr && cliBridge.lastPrUrl"
        :label="t('cli.viewPr')"
        icon="i-lucide-external-link"
        size="xs"
        variant="soft"
        :to="cliBridge.lastPrUrl"
        target="_blank"
      />
    </template>

    <!-- Claim button -->
    <UButton
      v-if="issue.state === 'OPEN' && initialCheckDone && !myClaim"
      :label="t('issues.detail.claim')"
      icon="i-lucide-hand"
      size="xs"
      variant="soft"
      @click="openDialog"
    />
  </div>

  <!-- Push / Create PR Dialog -->
  <UModal
    v-model:open="pushDialogOpen"
    :dismissible="!pushing"
  >
    <template #content>
      <div class="p-6 space-y-4 min-w-md">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ t('cli.createPr') }}
        </h2>
        <p class="text-sm text-muted">
          {{ needsPush ? t('cli.createPrDesc') : t('cli.createPrOnlyDesc') }}
        </p>
        <UFormField :label="t('cli.prTitle')">
          <UInput
            v-model="prTitle"
            class="w-full"
            size="lg"
          />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            v-if="!pushing"
            :label="t('profile.cancel')"
            variant="ghost"
            color="neutral"
            @click="pushDialogOpen = false"
          />
          <UButton
            :label="pushing ? t('cli.pushing') : needsPush ? t('cli.pushAndCreatePr') : t('cli.createPr')"
            icon="i-lucide-git-pull-request-arrow"
            :loading="pushing"
            :disabled="pushing || !prTitle.trim()"
            @click="doPush(true)"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Claim Dialog -->
  <UModal
    v-model:open="dialogOpen"
    :dismissible="!loading && !checkoutLoading"
  >
    <template #content>
      <div class="p-6 space-y-4 min-w-md">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ t('issues.detail.claimTitle') }}
        </h2>

        <!-- Loading branch status -->
        <div
          v-if="checking"
          class="text-sm text-muted"
        >
          {{ t('common.loading') }}
        </div>

        <!-- Pre-claim: branch name + options -->
        <template v-else-if="!claimResult">
          <p class="text-sm text-muted">
            {{ claimDescription }}
          </p>

          <!-- CLI status indicator -->
          <UAlert
            v-if="cliBridge.connected"
            icon="i-lucide-terminal"
            color="success"
            variant="subtle"
            :title="t('cli.connected')"
            :description="t('cli.willAutoCheckout')"
          />

          <!-- Others already working -->
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
              @click="dialogOpen = false"
            />
            <UButton
              v-if="branchStatus?.branchExists"
              :label="t('issues.detail.useExisting')"
              variant="soft"
              color="neutral"
              @click="dialogOpen = false"
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

        <!-- Post-claim: success + checkout result -->
        <template v-else>
          <UAlert
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
            :title="t('issues.detail.claimSuccess')"
            :description="claimResult.forked ? t('issues.detail.claimSuccessForked') : t('issues.detail.claimSuccessBranch')"
          />

          <!-- CLI checkout result -->
          <template v-if="cliBridge.connected">
            <!-- Checkout loading -->
            <div
              v-if="checkoutLoading"
              class="flex items-center gap-2 text-sm text-muted"
            >
              <UIcon
                name="i-lucide-loader"
                class="size-4 animate-spin"
              />
              {{ t('cli.checkingOut') }}
            </div>

            <!-- Checkout success -->
            <UAlert
              v-else-if="checkoutResult?.status === 'ok'"
              icon="i-lucide-terminal"
              color="success"
              variant="subtle"
              :title="t('cli.checkoutSuccess')"
              :description="checkoutResult.message"
            />

            <!-- Checkout error -->
            <template v-else-if="checkoutResult?.status === 'error'">
              <UAlert
                icon="i-lucide-terminal"
                color="error"
                variant="subtle"
                :title="t('cli.checkoutError')"
                :description="checkoutResult.message"
              />
              <UButton
                :label="t('common.retry')"
                icon="i-lucide-refresh-cw"
                variant="soft"
                size="sm"
                @click="retryCheckout"
              />
            </template>
          </template>

          <!-- No CLI: show command to copy -->
          <template v-else>
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
          </template>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              v-if="!cliBridge.connected"
              :label="t('issues.detail.copyCommand')"
              icon="i-lucide-copy"
              variant="soft"
              @click="copyCommand"
            />
            <UButton
              label="OK"
              @click="dialogOpen = false"
            />
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
