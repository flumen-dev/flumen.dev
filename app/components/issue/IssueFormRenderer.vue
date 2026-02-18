<script lang="ts" setup>
import { useVorm } from 'vorm-vue'
import { githubFormToVorm } from '~~/shared/utils/github-form-to-vorm'

const props = defineProps<{
  repoContext?: string
  fields: Array<{
    type: 'markdown' | 'input' | 'textarea' | 'dropdown' | 'checkboxes'
    id?: string
    attributes: Record<string, unknown>
    validations?: { required?: boolean }
  }>
}>()

const emit = defineEmits<{
  submit: [formData: Record<string, unknown>]
}>()

const { schema, markdownBlocks, initialData } = githubFormToVorm(props.fields)
const vorm = useVorm(schema)

// Pre-fill form data after Vorm is initialized
if (Object.keys(initialData).length) {
  vorm.setFormData(initialData)
}

function getFieldIndex(fieldName: string): number {
  return schema.findIndex(s => s.name === fieldName)
}

function getMarkdownBlocksAt(fieldName: string) {
  return markdownBlocks.filter(b => b.index === getFieldIndex(fieldName))
}

function handleSubmit() {
  if (!vorm.isValid) {
    vorm.validate()
    return
  }
  emit('submit', { ...vorm.formData })
}

defineExpose({ handleSubmit, vorm })
</script>

<template>
  <AutoVorm
    :vorm="vorm"
    class="space-y-5"
  >
    <template #wrapper="{ field, modelValue, 'onUpdate:modelValue': onUpdate, items, error }">
      <!-- Markdown blocks before this field -->
      <div
        v-for="block in getMarkdownBlocksAt(field.name)"
        :key="`md-${field.name}-${block.index}`"
        class="rounded-lg border border-default bg-elevated/30 p-4 mb-5"
      >
        <UiMarkdownRenderer
          :source="block.content"
          :linkify-mentions="false"
        />
      </div>

      <!-- Label + description (non-checkbox fields) -->
      <div v-if="field.type !== 'checkbox'">
        <label class="text-sm font-semibold text-highlighted">
          {{ field.label }}
        </label>
        <p
          v-if="field.helpText"
          class="text-xs text-muted mt-0.5"
        >
          {{ field.helpText }}
        </p>
      </div>

      <!-- Text input -->
      <UInput
        v-if="field.type === 'text'"
        :model-value="String(modelValue ?? '')"
        :placeholder="field.placeholder"
        size="lg"
        class="w-full"
        @update:model-value="onUpdate($event)"
        @blur="vorm.validateFieldByName(field.name)"
      />

      <!-- Textarea -->
      <div
        v-else-if="field.type === 'textarea'"
        class="rounded-md border border-default bg-default overflow-hidden"
      >
        <EditorMarkdownEditor
          :model-value="String(modelValue ?? '')"
          :repo-context="props.repoContext"
          :placeholder="field.placeholder"
          :show-header="true"
          :framed="false"
          min-height="12rem"
          class="w-full"
          @update:model-value="onUpdate($event)"
          @submit="handleSubmit"
          @blur="vorm.validateFieldByName(field.name)"
        />
      </div>

      <!-- Select -->
      <USelect
        v-else-if="field.type === 'select'"
        :model-value="String(modelValue ?? '')"
        :items="items"
        value-key="value"
        size="lg"
        class="w-full"
        @update:model-value="onUpdate($event)"
      />

      <!-- Checkbox -->
      <UCheckbox
        v-else-if="field.type === 'checkbox'"
        :model-value="modelValue === true"
        :label="field.label"
        @update:model-value="onUpdate($event)"
      />

      <!-- Validation error -->
      <p
        v-if="error"
        class="text-xs text-error mt-1"
      >
        {{ error }}
      </p>
    </template>
  </AutoVorm>

  <!-- Trailing markdown blocks (after all fields) -->
  <div
    v-for="(block, idx) in markdownBlocks.filter(b => b.index >= schema.length)"
    :key="`md-trail-${idx}`"
    class="rounded-lg border border-default bg-elevated/30 p-4 mt-5"
  >
    <UiMarkdownRenderer
      :source="block.content"
      :linkify-mentions="false"
    />
  </div>
</template>
