<script lang="ts" setup>
import type { CheckRunDetail } from '~~/shared/types/check-run'

const props = defineProps<{
  check: CheckRunDetail | null
  owner: string
  repo: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const requestFetch = useRequestFetch()

const logCache = new Map<number, string>()
const rawLog = ref<string | null>(null)
const logError = ref(false)
const logLoading = ref(false)

watch(() => props.check?.jobId, async (jobId) => {
  if (!jobId || !open.value) return
  await loadLog(jobId)
})

watch(open, async (isOpen) => {
  if (isOpen && props.check?.jobId) {
    await loadLog(props.check.jobId)
  }
})

async function loadLog(jobId: number) {
  if (logCache.has(jobId)) {
    rawLog.value = logCache.get(jobId)!
    logError.value = false
    return
  }

  logLoading.value = true
  logError.value = false
  rawLog.value = null

  try {
    const text = await requestFetch<string>(
      `/api/repository/${props.owner}/${props.repo}/actions/jobs/${jobId}/logs`,
    )
    const log = typeof text === 'string' ? text : JSON.stringify(text)
    logCache.set(jobId, log)
    rawLog.value = log
  }
  catch {
    logError.value = true
  }
  finally {
    logLoading.value = false
  }
}

interface LogSection {
  name: string
  lines: string[]
  collapsed: boolean
}

const parsedSections = computed<LogSection[]>(() => {
  if (!rawLog.value) return []

  const lines = rawLog.value.split('\n')
  const sections: LogSection[] = []
  let current: LogSection | null = null

  for (const raw of lines) {
    // Strip timestamp prefix (2026-02-28T19:42:22.1234567Z )
    const line = raw.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, '')

    if (line.startsWith('##[group]')) {
      if (current) sections.push(current)
      current = { name: line.replace('##[group]', ''), lines: [], collapsed: true }
      continue
    }

    if (line.startsWith('##[endgroup]')) {
      if (current) {
        sections.push(current)
        current = null
      }
      continue
    }

    // Skip other ##[] directives
    if (line.startsWith('##[')) continue

    if (current) {
      current.lines.push(line)
    }
    else {
      // Lines outside groups go into a default section
      if (!sections.length || sections[sections.length - 1]!.collapsed) {
        sections.push({ name: '', lines: [], collapsed: false })
      }
      sections[sections.length - 1]!.lines.push(line)
    }
  }

  if (current) sections.push(current)

  // Filter empty sections
  return sections.filter(s => s.lines.length > 0 || s.name)
})

const sectionOpen = ref<Record<number, boolean>>({})

function isSectionOpen(index: number) {
  const section = parsedSections.value[index]
  if (!section) return false
  // Non-collapsible sections (no name) are always open
  if (!section.name) return true
  return sectionOpen.value[index] ?? !section.collapsed
}

function toggleSection(index: number) {
  sectionOpen.value[index] = !isSectionOpen(index)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'sm:max-w-4xl lg:max-w-5xl' }"
  >
    <template #header>
      <div class="flex items-center gap-3 min-w-0">
        <UIcon
          v-if="check"
          :name="check.status === 'SUCCESS' ? 'i-lucide-check-circle-2' : check.status === 'FAILURE' ? 'i-lucide-x-circle' : 'i-lucide-loader-circle'"
          class="size-5 shrink-0"
          :class="check.status === 'SUCCESS' ? 'text-emerald-500' : check.status === 'FAILURE' ? 'text-red-500' : 'text-amber-500'"
        />
        <span class="font-semibold text-highlighted truncate">{{ check?.name }}</span>
        <span
          v-if="check?.durationSeconds !== null && check?.durationSeconds !== undefined"
          class="text-sm text-muted shrink-0"
        >
          {{ check.durationSeconds < 60 ? `${check.durationSeconds}s` : `${Math.floor(check.durationSeconds / 60)}m ${check.durationSeconds % 60}s` }}
        </span>
        <div class="flex-1" />
        <UButton
          v-if="check?.detailsUrl"
          icon="i-lucide-external-link"
          :label="t('workItems.ci.viewOnGithub')"
          variant="ghost"
          color="neutral"
          size="xs"
          :to="check.detailsUrl"
          target="_blank"
        />
      </div>
    </template>

    <template #body>
      <div
        v-if="logLoading"
        class="py-12 text-center text-muted"
      >
        {{ t('workItems.ci.loadingLogs') }}
      </div>

      <div
        v-else-if="logError"
        class="py-12 text-center text-muted"
      >
        {{ t('workItems.ci.logError') }}
      </div>

      <div
        v-else-if="parsedSections.length"
        class="space-y-0.5"
      >
        <div
          v-for="(section, idx) in parsedSections"
          :key="idx"
        >
          <!-- Section header (collapsible groups) -->
          <button
            v-if="section.name"
            type="button"
            class="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium rounded hover:bg-elevated/80 transition-colors"
            :class="isSectionOpen(idx) ? 'text-highlighted' : 'text-muted'"
            @click="toggleSection(idx)"
          >
            <UIcon
              :name="isSectionOpen(idx) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-3.5 shrink-0"
            />
            <span class="truncate">{{ section.name }}</span>
            <span class="text-muted/60 shrink-0">{{ section.lines.length }} lines</span>
          </button>

          <!-- Log lines -->
          <pre
            v-if="isSectionOpen(idx)"
            class="text-[11px] leading-[1.6] font-mono px-3 py-1 overflow-x-auto text-muted whitespace-pre"
          ><template
              v-for="(line, li) in section.lines"
              :key="li"
            ><span :class="line.includes('FAIL') || line.includes('Error') || line.includes('error') ? 'text-red-400' : line.includes('##[warning]') ? 'text-amber-400' : ''">{{ line }}
</span></template></pre>
        </div>
      </div>
    </template>
  </UModal>
</template>
