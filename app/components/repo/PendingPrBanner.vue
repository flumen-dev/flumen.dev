<script lang="ts" setup>
import type { PendingBranch } from '~~/server/api/repository/[owner]/[repo]/pending-branches.get'

const props = defineProps<{
  owner: string
  repo: string
}>()

const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const apiFetch = useRequestFetch()

const branches = ref<PendingBranch[]>([])
const creating = ref<string | null>(null)
const dismissed = ref<Set<string>>(new Set())

const dialogOpen = ref(false)
const activeBranch = ref<PendingBranch | null>(null)
const prTitle = ref('')
const prDraft = ref(true)
const linkedIssueNumber = ref<number | undefined>(undefined)

// Load repo issues for autocomplete
interface IssueOption { label: string, value: number, title: string }
const issueOptions = ref<IssueOption[]>([])

async function fetchIssues() {
  try {
    const data = await apiFetch<RepoIssue[]>(`/api/repository/${props.owner}/${props.repo}/issues`)
    issueOptions.value = data.map(i => ({
      label: `#${i.number} ${i.title}`,
      value: i.number,
      title: i.title,
    }))
  }
  catch {
    issueOptions.value = []
  }
}

const selectedIssue = computed(() => issueOptions.value.find(i => i.value === linkedIssueNumber.value))

const visibleBranches = computed(() =>
  branches.value.filter(b => !dismissed.value.has(b.branch)),
)

async function fetchPending() {
  try {
    branches.value = await apiFetch<PendingBranch[]>(
      `/api/repository/${props.owner}/${props.repo}/pending-branches`,
    )
  }
  catch {
    // Silently skip
  }
}

onMounted(fetchPending)

function openDialog(branch: PendingBranch) {
  activeBranch.value = branch
  prTitle.value = branch.branch.replace(/^issue-\d+-/, '').replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
  prDraft.value = true

  const match = branch.branch.match(/^issue-(\d+)/)
  linkedIssueNumber.value = match ? Number(match[1]) : undefined

  dialogOpen.value = true
  if (!issueOptions.value.length) fetchIssues()
}

async function createPr() {
  if (!activeBranch.value || creating.value) return
  const branch = activeBranch.value
  creating.value = branch.branch

  try {
    const result = await apiFetch<{ number: number }>('/api/pull-requests/create', {
      method: 'POST',
      body: {
        repo: `${props.owner}/${props.repo}`,
        head: branch.branch,
        base: branch.defaultBranch,
        title: prTitle.value,
        body: linkedIssueNumber.value ? `Closes #${linkedIssueNumber.value}` : '',
        draft: prDraft.value,
        workItemId: linkedIssueNumber.value ? String(linkedIssueNumber.value) : undefined,
      },
    })

    dialogOpen.value = false
    toast.add({
      title: t('pendingPr.created'),
      description: prDraft.value ? t('pendingPr.draftHint') : undefined,
      color: 'success',
    })

    navigateTo(localePath(`/repos/${props.owner}/${props.repo}/work-items/${result.number}`))
  }
  catch {
    toast.add({ title: t('pendingPr.createFailed'), color: 'error' })
  }
  finally {
    creating.value = null
  }
}

function dismiss(branch: string) {
  dismissed.value = new Set([...dismissed.value, branch])
}
</script>

<template>
  <div>
    <div
      v-for="branch in visibleBranches"
      :key="branch.branch"
      class="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <UIcon
        name="i-lucide-git-branch"
        class="size-5 text-primary shrink-0"
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm">
          <span class="font-mono text-xs font-medium text-primary">{{ branch.branch }}</span>
          <span class="text-muted ml-1">
            {{ t('pendingPr.hadRecentPush', { count: branch.aheadBy }) }}
          </span>
        </p>
      </div>
      <UButton
        :label="t('pendingPr.createPr')"
        icon="i-lucide-git-pull-request-arrow"
        size="xs"
        color="primary"
        @click="openDialog(branch)"
      />
      <UButton
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.close')"
        @click="dismiss(branch.branch)"
      />
    </div>

    <UModal
      v-model:open="dialogOpen"
      :dismissible="!creating"
    >
      <template #content>
        <div
          v-if="activeBranch"
          class="p-6 space-y-5 w-lg"
        >
          <div class="flex items-center gap-2.5">
            <div class="flex items-center justify-center size-8 rounded-full bg-primary/10">
              <UIcon
                name="i-lucide-git-pull-request-arrow"
                class="size-4.5 text-primary"
              />
            </div>
            <div>
              <h3 class="text-sm font-semibold">
                {{ t('pendingPr.createPr') }}
              </h3>
              <p class="text-xs text-muted">
                {{ activeBranch.branch }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 rounded-md border border-default bg-elevated/50 px-3 py-2 text-xs text-muted">
            <div class="flex items-center gap-1.5">
              <UIcon
                name="i-lucide-git-branch"
                class="size-3.5"
              />
              <span class="font-mono font-medium text-highlighted">{{ activeBranch.branch }}</span>
            </div>
            <UIcon
              name="i-lucide-arrow-right"
              class="size-3 text-dimmed"
            />
            <span class="font-mono">{{ activeBranch.defaultBranch }}</span>
            <span class="ml-auto flex items-center gap-1">
              <UIcon
                name="i-lucide-git-commit-horizontal"
                class="size-3"
              />
              {{ t('pendingPr.commitsAhead', { count: activeBranch.aheadBy }) }}
            </span>
          </div>

          <UFormField :label="t('pendingPr.prTitle')">
            <UInput
              v-model="prTitle"
              :placeholder="t('pendingPr.prTitle')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('pendingPr.linkIssue')">
            <USelectMenu
              v-model="linkedIssueNumber"
              :items="issueOptions"
              :placeholder="t('pendingPr.searchIssue')"
              value-key="value"
              searchable
              class="w-full"
            />
            <template
              v-if="selectedIssue"
              #hint
            >
              <span class="flex items-center gap-1 text-xs text-primary">
                <UIcon
                  name="i-lucide-link"
                  class="size-3"
                />
                Closes #{{ selectedIssue.value }}
              </span>
            </template>
          </UFormField>

          <div class="flex items-center justify-between rounded-md border border-default bg-elevated/50 px-3 py-2.5">
            <div>
              <p class="text-sm font-medium">
                {{ t('pendingPr.draftPr') }}
              </p>
              <p class="text-xs text-muted mt-0.5">
                {{ t('pendingPr.draftHint') }}
              </p>
            </div>
            <USwitch v-model="prDraft" />
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              :disabled="!!creating"
              @click="dialogOpen = false"
            />
            <UButton
              :label="t('pendingPr.createPr')"
              icon="i-lucide-git-pull-request-arrow"
              :loading="!!creating"
              :disabled="!prTitle.trim()"
              @click="createPr"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
