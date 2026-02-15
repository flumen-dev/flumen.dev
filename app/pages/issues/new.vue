<script lang="ts" setup>
import type { IssueTemplate, IssueFormTemplate } from '~~/server/api/issues/templates.get'
import { formDataToMarkdown } from '~~/shared/utils/form-data-to-markdown'

definePageMeta({
  middleware: 'auth',
  titleKey: 'issues.create.title',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const store = useIssueStore()
const apiFetch = useRequestFetch()
const toast = useToast()

const repo = computed(() => (route.query.repo as string) || store.selectedRepo || null)

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

watchEffect(async () => {
  if (!repo.value) {
    step.value = 'form'
    return
  }

  try {
    const data = await apiFetch<{ repositoryId: string, templates: IssueTemplate[] }>(
      '/api/issues/templates',
      { params: { repo: repo.value } },
    )
    repositoryId.value = data.repositoryId
    templates.value = data.templates
    hasTemplates.value = data.templates.length > 0
    step.value = data.templates.length ? 'templates' : 'form'
  }
  catch {
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
  if (!title.value.trim() || submitting.value || !repo.value) return
  submitting.value = true

  try {
    const result = await apiFetch<{ number: number }>('/api/issues/create', {
      method: 'POST',
      body: {
        repositoryId: repositoryId.value,
        title: title.value,
        body: issueBody,
        repo: repo.value,
      },
    })
    toast.add({ title: t('issues.create.success'), color: 'success' })
    await router.push(localePath({ path: `/issues/${result.number}`, query: { repo: repo.value } }))
  }
  catch {
    toast.add({ title: t('issues.create.error'), color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

function submitPlain() {
  submitIssue(body.value)
}

function submitForm(formData: Record<string, unknown>) {
  if (!selectedFormTemplate.value) return
  const markdown = formDataToMarkdown(selectedFormTemplate.value.body, formData)
  submitIssue(markdown)
}
</script>

<template>
  <div class="p-4 max-w-3xl mx-auto">
    <!-- Page header with repo context -->
    <div
      v-if="repo"
      class="mb-6"
    >
      <h1 class="text-xl font-semibold">
        {{ t('issues.create.title') }}
      </h1>
      <p class="text-sm text-muted mt-1">
        <UIcon
          name="i-lucide-git-fork"
          class="size-3.5 align-text-bottom mr-0.5"
        />
        {{ repo }}
      </p>
    </div>

    <!-- No repo selected -->
    <UAlert
      v-if="!repo"
      :title="t('issues.create.noRepo')"
      color="warning"
      icon="i-lucide-alert-triangle"
    />

    <!-- Loading templates -->
    <div
      v-else-if="step === 'loading'"
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
        :label="t('issues.create.backToTemplates')"
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
          {{ t('issues.create.titleLabel') }}
        </label>
        <UInput
          id="issue-title"
          v-model="title"
          :placeholder="t('issues.create.titlePlaceholder')"
          class="flex-1"
          autofocus
        />
      </div>

      <!-- Form fields rendered by Vorm -->
      <IssueFormRenderer
        ref="formRenderer"
        :fields="selectedFormTemplate.body"
        @submit="submitForm"
      />

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2">
        <UButton
          :label="t('profile.cancel')"
          color="neutral"
          variant="ghost"
          :to="localePath('/issues')"
        />
        <UButton
          :label="submitting ? t('issues.create.submitting') : t('issues.create.submit')"
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
        :label="t('issues.create.backToTemplates')"
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
          {{ t('issues.create.titleLabel') }}
        </label>
        <UInput
          id="issue-title-plain"
          v-model="title"
          :placeholder="t('issues.create.titlePlaceholder')"
          class="flex-1"
          autofocus
          @keydown.meta.enter="submitPlain"
          @keydown.ctrl.enter="submitPlain"
        />
      </div>

      <!-- Body -->
      <div class="space-y-1">
        <label class="text-sm font-medium">
          {{ t('issues.create.bodyLabel') }}
        </label>
        <IssueMarkdownEditor
          v-model="body"
          :placeholder="t('issues.create.bodyPlaceholder')"
          @submit="submitPlain"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2">
        <UButton
          :label="t('profile.cancel')"
          color="neutral"
          variant="ghost"
          :to="localePath('/issues')"
        />
        <UButton
          :label="submitting ? t('issues.create.submitting') : t('issues.create.submit')"
          icon="i-lucide-plus"
          :loading="submitting"
          :disabled="!title.trim()"
          @click="submitPlain"
        />
      </div>
    </div>
  </div>
</template>
