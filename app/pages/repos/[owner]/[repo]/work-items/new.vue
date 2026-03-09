<script lang="ts" setup>
import type { IssueTemplate, IssueFormTemplate } from '~~/server/api/issues/templates.get'
import { normalizeMarkdownMentions } from '~/utils/normalizeMarkdownMentions'
import { buildWorkItemPath } from '~/utils/workItemPath'

definePageMeta({
  middleware: 'auth',
  titleKey: 'workItems.create.title',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const apiFetch = useRequestFetch()
const toast = useToast()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
const repoFullName = computed(() => `${owner.value}/${repo.value}`)

// Form state
const title = ref('')
const body = ref('')
const submitting = ref(false)

// Template state
const step = ref<'loading' | 'templates' | 'form' | 'formTemplate'>('loading')
const templates = ref<IssueTemplate[]>([])
const repositoryId = ref('')
const hasTemplates = ref(false)
const selectedFormTemplate = ref<IssueFormTemplate | null>(null)
const formRenderer = ref<{ handleSubmit: () => void, vorm: { formData: Record<string, unknown> } }>()
const plainBodyDraftKey = computed(() => `issue-create-body:${repoFullName.value}`)
const { hasDraft: hasPlainBodyDraft, discardDraft: discardPlainBodyDraft, markSavedBaseline: markPlainBodyDraftSaved } = useMarkdownDraft({
  key: plainBodyDraftKey,
  value: body,
  enabled: computed(() => step.value === 'form'),
  onRestored: () => {
    toast.add({
      title: t('workItems.draft.restored'),
      color: 'info',
    })
  },
})

watchEffect(async () => {
  const currentRepo = repoFullName.value
  try {
    const data = await apiFetch<{ repositoryId: string, templates: IssueTemplate[] }>(
      '/api/issues/templates',
      { params: { repo: repoFullName.value } },
    )
    if (repoFullName.value !== currentRepo) return
    repositoryId.value = data.repositoryId
    templates.value = data.templates
    hasTemplates.value = data.templates.length > 0
    step.value = data.templates.length ? 'templates' : 'form'
  }
  catch {
    if (repoFullName.value !== currentRepo) return
    step.value = 'form'
  }
})

function selectTemplate(template: IssueTemplate | null) {
  if (!template) {
    selectedFormTemplate.value = null
    step.value = 'form'
    return
  }

  if (template.type === 'form') {
    selectedFormTemplate.value = template
    title.value = template.title
    step.value = 'formTemplate'
  }
  else {
    selectedFormTemplate.value = null
    title.value = template.title
    body.value = template.body
    step.value = 'form'
  }
}

function backToTemplates() {
  title.value = ''
  body.value = ''
  selectedFormTemplate.value = null
  step.value = 'templates'
}

async function submitIssue(issueBody: string) {
  if (!title.value.trim() || submitting.value) return
  submitting.value = true
  const normalizedBody = normalizeMarkdownMentions(issueBody)

  try {
    const result = await apiFetch<{ number: number }>('/api/issues/create', {
      method: 'POST',
      body: {
        repositoryId: repositoryId.value,
        title: title.value,
        body: normalizedBody,
        repo: repoFullName.value,
      },
    })
    toast.add({ title: t('workItems.create.success'), color: 'success' })
    await router.push(localePath(buildWorkItemPath(repoFullName.value, result.number)!))
    return true
  }
  catch {
    toast.add({ title: t('workItems.create.error'), color: 'error' })
    return false
  }
  finally {
    submitting.value = false
  }
}

async function submitPlain() {
  const success = await submitIssue(body.value)
  if (!success) return
  markPlainBodyDraftSaved()
}

function submitForm(formData: Record<string, unknown>) {
  if (!selectedFormTemplate.value) return
  const markdown = formDataToMarkdown(selectedFormTemplate.value.body, formData)
  submitIssue(markdown)
}
</script>

<template>
  <div class="p-4 max-w-3xl mx-auto">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 mb-6">
      <NuxtLinkLocale
        :to="`/repos/${owner}/${repo}`"
        class="text-sm font-semibold text-highlighted hover:text-primary transition-colors"
      >
        {{ repoFullName }}
      </NuxtLinkLocale>
      <span class="text-sm text-muted">/</span>
      <NuxtLinkLocale
        :to="`/repos/${owner}/${repo}/work-items`"
        class="text-sm text-muted hover:text-primary transition-colors"
      >
        {{ t('repos.detail.workItems') }}
      </NuxtLinkLocale>
      <span class="text-sm text-muted">/</span>
      <span class="text-sm text-muted">{{ t('workItems.create.title') }}</span>
    </div>

    <!-- Page header -->
    <div class="mb-6">
      <h1 class="text-xl font-semibold">
        {{ t('workItems.create.title') }}
      </h1>
      <p class="text-sm text-muted mt-1">
        <UIcon
          name="i-lucide-git-fork"
          class="size-3.5 align-text-bottom mr-0.5"
        />
        {{ repoFullName }}
      </p>
    </div>

    <!-- Loading templates -->
    <div
      v-if="step === 'loading'"
      class="flex items-center justify-center py-16 text-muted gap-2"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="size-5 animate-spin"
      />
      {{ t('common.loading') }}
    </div>

    <!-- Template picker -->
    <IssueTemplatePicker
      v-else-if="step === 'templates'"
      :templates="templates"
      @select="selectTemplate"
    />

    <!-- YAML Form template -->
    <div
      v-else-if="step === 'formTemplate' && selectedFormTemplate"
      class="space-y-4"
    >
      <UButton
        v-if="hasTemplates"
        :label="t('workItems.create.backToTemplates')"
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="sm"
        @click="backToTemplates"
      />

      <!-- Title -->
      <div class="flex items-center gap-3">
        <label
          for="issue-title"
          class="text-sm font-semibold text-highlighted shrink-0"
        >
          {{ t('workItems.create.titleLabel') }}
        </label>
        <UInput
          id="issue-title"
          v-model="title"
          :placeholder="t('workItems.create.titlePlaceholder')"
          class="flex-1"
          autofocus
        />
      </div>

      <!-- Form fields rendered by Vorm -->
      <IssueFormRenderer
        ref="formRenderer"
        :repo-context="repoFullName"
        :fields="selectedFormTemplate.body"
        @submit="submitForm"
      />

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2">
        <UButton
          :label="t('profile.cancel')"
          color="neutral"
          variant="ghost"
          :to="localePath(`/repos/${owner}/${repo}/work-items`)"
        />
        <UButton
          v-if="hasPlainBodyDraft"
          :label="t('workItems.draft.discard')"
          color="neutral"
          variant="ghost"
          @click="discardPlainBodyDraft()"
        />
        <UButton
          :label="submitting ? t('workItems.create.submitting') : t('workItems.create.submit')"
          icon="i-lucide-plus"
          :loading="submitting"
          :disabled="!title.trim()"
          @click="formRenderer?.handleSubmit()"
        />
      </div>
    </div>

    <!-- Plain markdown form (blank or .md template) -->
    <div
      v-else-if="step === 'form'"
      class="space-y-4"
    >
      <UButton
        v-if="hasTemplates"
        :label="t('workItems.create.backToTemplates')"
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="sm"
        @click="backToTemplates"
      />

      <!-- Title -->
      <div class="flex items-center gap-3">
        <label
          for="issue-title-plain"
          class="text-sm font-medium shrink-0"
        >
          {{ t('workItems.create.titleLabel') }}
        </label>
        <UInput
          id="issue-title-plain"
          v-model="title"
          :placeholder="t('workItems.create.titlePlaceholder')"
          class="flex-1"
          autofocus
          @keydown.meta.enter="submitPlain"
          @keydown.ctrl.enter="submitPlain"
        />
      </div>

      <!-- Body -->
      <div class="space-y-1">
        <label class="text-sm font-medium">
          {{ t('workItems.create.bodyLabel') }}
        </label>
        <div class="rounded-md border border-default bg-default overflow-hidden">
          <EditorMarkdownEditor
            v-model="body"
            :repo-context="repoFullName"
            :placeholder="t('workItems.create.bodyPlaceholder')"
            :show-header="true"
            :framed="false"
            @submit="submitPlain"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2">
        <UButton
          :label="t('profile.cancel')"
          color="neutral"
          variant="ghost"
          :to="localePath(`/repos/${owner}/${repo}/work-items`)"
        />
        <UButton
          v-if="hasPlainBodyDraft"
          :label="t('workItems.draft.discard')"
          color="neutral"
          variant="ghost"
          @click="discardPlainBodyDraft()"
        />
        <UButton
          :label="submitting ? t('workItems.create.submitting') : t('workItems.create.submit')"
          icon="i-lucide-plus"
          :loading="submitting"
          :disabled="!title.trim()"
          @click="submitPlain"
        />
      </div>
    </div>
  </div>
</template>
