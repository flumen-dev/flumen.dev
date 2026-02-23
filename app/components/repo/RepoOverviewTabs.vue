<script setup lang="ts">
import type { RepoTreeEntry } from '~~/shared/types/repository'

const props = defineProps<{
  specialFileEntries: RepoTreeEntry[]
  activeContent: string
  repoContext: string
  owner: string
  repo: string
  currentPath: string
  entries: RepoTreeEntry[]
}>()

const emit = defineEmits<{
  navigate: [path: string]
  navigateUp: []
}>()

const activeTab = defineModel<string>('activeTab', { default: '' })

const { t } = useI18n()

const TAB_LABELS = computed<Record<string, string>>(() => ({
  'README.md': t('repos.detail.specialFiles.readme'),
  'CODE_OF_CONDUCT.md': t('repos.detail.specialFiles.codeOfConduct'),
  'CONTRIBUTING.md': t('repos.detail.specialFiles.contributing'),
  'LICENSE': t('repos.detail.specialFiles.license'),
  'LICENSE.md': t('repos.detail.specialFiles.license'),
  'SECURITY.md': t('repos.detail.specialFiles.security'),
}))

const TAB_ICONS: Record<string, string> = {
  'README.md': 'i-lucide-book-open',
  'CODE_OF_CONDUCT.md': 'i-lucide-heart-handshake',
  'CONTRIBUTING.md': 'i-lucide-git-pull-request-arrow',
  'LICENSE': 'i-lucide-scale',
  'LICENSE.md': 'i-lucide-scale',
  'SECURITY.md': 'i-lucide-shield-check',
}

const CODE_TAB_VALUE = '__code__'

const tabs = computed(() => {
  const readmeEntry = props.specialFileEntries.find(entry => entry.name.toLowerCase().startsWith('readme'))
  const otherEntries = props.specialFileEntries.filter(entry => entry !== readmeEntry)

  const readmeTab = readmeEntry
    ? [{
        label: TAB_LABELS.value[readmeEntry.name] ?? readmeEntry.name,
        icon: TAB_ICONS[readmeEntry.name] ?? 'i-lucide-file-text',
        value: readmeEntry.path,
      }]
    : []

  const otherTabs = otherEntries.map(f => ({
    label: TAB_LABELS.value[f.name] ?? f.name,
    icon: TAB_ICONS[f.name] ?? 'i-lucide-file-text',
    value: f.path,
  }))

  const codeTab = {
    label: t('repos.detail.codeBrowser.code'),
    icon: 'i-lucide-folder-tree',
    value: CODE_TAB_VALUE,
  }

  return [...readmeTab, codeTab, ...otherTabs]
})

const isCodeTab = computed(() => activeTab.value === CODE_TAB_VALUE)

const isMarkdown = computed(() => {
  if (isCodeTab.value) return false
  return activeTab.value.toLowerCase().endsWith('.md')
})

const rawProxyBase = computed(() => `/api/repository/${props.owner}/${props.repo}/raw`)

const pathSegments = computed(() => props.currentPath.split('/').filter(Boolean))
</script>

<template>
  <div>
    <UTabs
      v-model="activeTab"
      :items="tabs"
      :content="false"
      size="md"
      variant="link"
    />

    <UCard v-if="isCodeTab">
      <div class="flex items-center gap-1 px-3 py-2 border-b border-default text-sm">
        <button
          class="text-primary hover:underline cursor-pointer"
          @click="emit('navigate', '')"
        >
          {{ repoContext.split('/')[1] }}
        </button>
        <template
          v-for="(part, idx) in pathSegments"
          :key="idx"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5 text-dimmed"
          />
          <button
            class="hover:underline cursor-pointer"
            :class="idx === pathSegments.length - 1 ? 'text-highlighted font-medium' : 'text-primary'"
            @click="emit('navigate', pathSegments.slice(0, idx + 1).join('/'))"
          >
            {{ part }}
          </button>
        </template>
      </div>

      <div
        v-if="currentPath"
        class="border-b border-default"
      >
        <button
          class="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-elevated transition-colors cursor-pointer text-sm text-primary"
          @click="emit('navigateUp')"
        >
          <UIcon
            name="i-lucide-corner-left-up"
            class="size-4"
          />
          ..
        </button>
      </div>

      <RepoFileTree
        :entries="entries"
        @navigate="emit('navigate', $event)"
      />
      <div
        v-if="!entries.length"
        class="text-center py-8 text-dimmed text-sm"
      >
        {{ $t('repos.detail.codeBrowser.emptyDirectory') }}
      </div>
    </UCard>

    <UCard v-else>
      <div class="p-4">
        <UiMarkdownRenderer
          v-if="isMarkdown"
          :source="activeContent"
          :repo-context="repoContext"
          :raw-proxy-base="rawProxyBase"
          :breaks="false"
          :linkify-mentions="true"
        />

        <pre
          v-else
          class="text-sm text-muted whitespace-pre-wrap wrap-break-word"
        >{{ activeContent }}</pre>
      </div>
    </UCard>
  </div>
</template>
