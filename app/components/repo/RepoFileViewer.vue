<script setup lang="ts">
import type { RepoFileContent } from '~~/shared/types/repository'

const props = defineProps<{
  file: RepoFileContent
  repoContext: string
  githubUrl: string
  branch?: string
}>()

const MAX_SIZE = 500 * 1024 // 500KB

const isTooLarge = computed(() => props.file.size > MAX_SIZE)
const isMarkdown = computed(() => props.file.name.toLowerCase().endsWith('.md'))
const showRendered = ref(true)
const githubBranch = computed(() => props.branch || 'HEAD')
const rawProxyBase = computed(() => {
  const [owner, repo] = props.repoContext.split('/')
  if (!owner || !repo) {
    return `/api/repository/${props.repoContext}/raw`
  }
  return `/api/repository/${owner}/${repo}/raw`
})

const lines = computed(() => {
  if (isTooLarge.value) return []
  return props.file.content.split('\n')
})
</script>

<template>
  <div>
    <!-- Too large warning -->
    <div
      v-if="isTooLarge"
      class="text-center py-8"
    >
      <UIcon
        name="i-lucide-file-warning"
        class="size-8 mb-2 text-warning"
      />
      <p class="text-sm text-muted mb-3">
        {{ $t('repos.detail.codeBrowser.fileTooLarge') }}
      </p>
      <UButton
        :to="`${githubUrl}/blob/${githubBranch}/${file.path}`"
        target="_blank"
        icon="i-lucide-external-link"
        size="sm"
        color="neutral"
        variant="outline"
      >
        {{ $t('repos.detail.codeBrowser.viewOnGithub') }}
      </UButton>
    </div>

    <!-- Markdown toggle -->
    <template v-else>
      <div
        v-if="isMarkdown"
        class="flex items-center gap-2 px-3 py-2 border-b border-default"
      >
        <UButton
          size="xs"
          :variant="showRendered ? 'solid' : 'ghost'"
          color="neutral"
          @click="showRendered = true"
        >
          {{ $t('repos.detail.codeBrowser.preview') }}
        </UButton>
        <UButton
          size="xs"
          :variant="!showRendered ? 'solid' : 'ghost'"
          color="neutral"
          @click="showRendered = false"
        >
          {{ $t('repos.detail.codeBrowser.code') }}
        </UButton>
      </div>

      <!-- Rendered markdown -->
      <div
        v-if="isMarkdown && showRendered"
        class="p-4"
      >
        <UiMarkdownRenderer
          :source="file.content"
          :repo-context="repoContext"
          :raw-proxy-base="rawProxyBase"
          :breaks="false"
          :linkify-mentions="true"
        />
      </div>

      <!-- Source code view -->
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full text-xs font-mono">
          <tbody>
            <tr
              v-for="(line, idx) in lines"
              :key="idx"
              class="hover:bg-elevated"
            >
              <td class="select-none text-right text-dimmed px-3 py-0.5 w-1 whitespace-nowrap border-r border-default">
                {{ idx + 1 }}
              </td>
              <td class="px-3 py-0.5 whitespace-pre">
                {{ line }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
