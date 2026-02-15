<script lang="ts" setup>
import type { IssueTemplate } from '~~/server/api/issues/templates.get'

defineProps<{
  templates: IssueTemplate[]
}>()

const emit = defineEmits<{
  select: [template: IssueTemplate | null]
}>()

const { t } = useI18n()

function getDescription(template: IssueTemplate): string {
  return template.type === 'form' ? template.description : template.about
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      {{ t('issues.create.chooseTemplate') }}
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="template in templates"
        :key="template.filename"
        class="text-left p-4 rounded-lg border border-default hover:bg-elevated transition-colors cursor-pointer"
        @click="emit('select', template)"
      >
        <div class="font-medium text-sm flex items-center gap-2">
          <UIcon
            :name="template.type === 'form' ? 'i-lucide-list' : 'i-lucide-file-text'"
            class="size-4 text-muted"
          />
          {{ template.name }}
        </div>
        <p
          v-if="getDescription(template)"
          class="text-xs text-muted mt-1"
        >
          {{ getDescription(template) }}
        </p>
      </button>

      <button
        class="text-left p-4 rounded-lg border border-default hover:bg-elevated transition-colors cursor-pointer"
        @click="emit('select', null)"
      >
        <div class="font-medium text-sm flex items-center gap-2">
          <UIcon
            name="i-lucide-file-plus"
            class="size-4"
          />
          {{ t('issues.create.blankIssue') }}
        </div>
        <p class="text-xs text-muted mt-1">
          {{ t('issues.create.blankIssueDescription') }}
        </p>
      </button>
    </div>
  </div>
</template>
