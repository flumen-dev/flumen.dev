<script setup lang="ts">
import type { RepoTreeEntry, RepoFileContent } from '~~/shared/types/repository'

const props = defineProps<{
  currentPath: string
  entries: RepoTreeEntry[]
  file: RepoFileContent | null
  browsingFile: boolean
  repoContext: string
  githubUrl: string
  branch?: string
}>()

const emit = defineEmits<{
  navigate: [path: string]
  navigateUp: []
  exit: []
}>()

const pathSegments = computed(() => props.currentPath.split('/').filter(Boolean))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-arrow-left"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="emit('exit')"
        >
          {{ $t('repos.detail.codeBrowser.backToOverview') }}
        </UButton>
        <USeparator
          orientation="vertical"
          class="h-4"
        />
        <UIcon
          name="i-lucide-folder-tree"
          class="size-4 text-muted"
        />
        <span class="text-sm font-medium">
          {{ $t('repos.detail.codeBrowser.title') }}
        </span>
      </div>
    </template>

    <!-- Breadcrumb -->
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

    <!-- Directory listing -->
    <template v-if="!browsingFile">
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
    </template>

    <!-- File viewer -->
    <RepoFileViewer
      v-else-if="file"
      :file="file"
      :repo-context="repoContext"
      :github-url="githubUrl"
      :branch="branch"
    />
  </UCard>
</template>
