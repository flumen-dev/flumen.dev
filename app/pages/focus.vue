<script setup lang="ts">
definePageMeta({
  titleKey: 'nav.focus',
  middleware: 'auth',
})

const { t } = useI18n()
const store = useFocusStore()

// Load counts on mount (lightweight, single API call)
onMounted(() => store.fetchCounts())

const sections = [
  { key: 'workingOn' as const, icon: 'i-lucide-hammer', emptyIcon: 'i-lucide-hard-hat' },
  { key: 'inbox' as const, icon: 'i-lucide-inbox', emptyIcon: 'i-lucide-mail' },
  { key: 'created' as const, icon: 'i-lucide-pen-line', emptyIcon: 'i-lucide-file-text' },
  { key: 'watching' as const, icon: 'i-lucide-eye', emptyIcon: 'i-lucide-bookmark' },
  { key: 'recent' as const, icon: 'i-lucide-clock', emptyIcon: 'i-lucide-activity' },
] as const

type SectionKey = typeof sections[number]['key']

function sectionState(key: SectionKey) {
  return store[key]
}

const sectionCounts = computed(() => {
  const result: Record<SectionKey, number | null> = {
    workingOn: null,
    inbox: null,
    created: null,
    watching: null,
    recent: null,
  }

  for (const key of ['workingOn', 'inbox', 'created', 'watching', 'recent'] as SectionKey[]) {
    const state = sectionState(key)

    if (key === 'inbox') {
      if (state.fetchedAt) {
        result[key] = store.inboxTotalCount
      }
      else if (store.counts) {
        result[key] = store.counts.inbox
      }
    }
    else if (key === 'created' && state.fetchedAt) {
      result[key] = store.createdTotalCount
    }
    else if (state.fetchedAt && 'data' in state) {
      result[key] = (state.data as unknown[]).length
    }
    else if (store.counts) {
      if (key === 'workingOn') result[key] = store.counts.workingOn
      else if (key === 'created') {
        result[key] = store.createdStateFilter === 'closed'
          ? store.counts.createdClosed
          : store.counts.createdOpen
      }
    }
  }

  return result
})
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Intro -->
    <div class="flex items-center gap-3">
      <UIcon
        name="i-lucide-crosshair"
        class="size-6 text-primary shrink-0"
      />
      <div>
        <h1 class="text-lg font-semibold text-highlighted">
          {{ t('focus.title') }}
        </h1>
        <p class="text-sm text-muted">
          {{ t('focus.description') }}
        </p>
      </div>
    </div>

    <section
      v-for="s in sections"
      :key="s.key"
      class="rounded-lg border border-default"
    >
      <!-- Section header -->
      <button
        class="flex w-full items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-elevated transition-colors"
        :class="{ 'rounded-lg': store.expanded !== s.key, 'rounded-t-lg': store.expanded === s.key }"
        @click="store.toggle(s.key)"
      >
        <UIcon
          :name="s.icon"
          class="size-5 text-highlighted shrink-0"
        />
        <h2 class="text-sm font-semibold text-highlighted">
          {{ t(`focus.${s.key}.title`) }}
        </h2>

        <!-- Count badge -->
        <USkeleton
          v-if="store.countsLoading && sectionCounts[s.key] == null"
          class="h-5 w-6 rounded-full"
        />
        <UBadge
          v-else-if="sectionCounts[s.key] != null && sectionCounts[s.key]! > 0"
          :label="String(sectionCounts[s.key])"
          color="neutral"
          variant="subtle"
          size="sm"
        />

        <!-- Inbox: "New" badge -->
        <UBadge
          v-if="s.key === 'inbox' && store.inboxNewCount > 0"
          :label="`+${store.inboxNewCount} ${t('focus.inbox.new')}`"
          color="primary"
          variant="solid"
          size="sm"
          class="cursor-pointer"
          @click.stop="store.refreshInboxNew()"
        />

        <!-- Created: state filter chips -->
        <template v-if="s.key === 'created' && store.expanded === 'created'">
          <div
            class="flex items-center gap-1 ml-2"
            @click.stop
          >
            <UBadge
              :label="t('issues.open')"
              :color="store.createdStateFilter === 'open' ? 'primary' : 'neutral'"
              :variant="store.createdStateFilter === 'open' ? 'solid' : 'subtle'"
              size="sm"
              class="cursor-pointer"
              @click="store.setCreatedFilter('open')"
            />
            <UBadge
              :label="t('issues.closed')"
              :color="store.createdStateFilter === 'closed' ? 'primary' : 'neutral'"
              :variant="store.createdStateFilter === 'closed' ? 'solid' : 'subtle'"
              size="sm"
              class="cursor-pointer"
              @click="store.setCreatedFilter('closed')"
            />
          </div>
        </template>

        <div class="ml-auto flex items-center gap-2">
          <UIcon
            v-if="sectionState(s.key).loading"
            name="i-lucide-loader-2"
            class="size-4 text-dimmed animate-spin"
          />
          <UIcon
            :name="store.expanded === s.key ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="size-4 text-dimmed"
          />
        </div>
      </button>

      <!-- Expanded content -->
      <div
        v-if="store.expanded === s.key"
        class="border-t border-default"
      >
        <FocusWorkingOnSection v-if="s.key === 'workingOn'" />

        <FocusInboxSection v-else-if="s.key === 'inbox'" />

        <FocusCreatedSection v-else-if="s.key === 'created'" />

        <!-- Watching: placeholder -->
        <template v-else-if="s.key === 'watching'">
          <div class="p-6 text-center">
            <UIcon
              name="i-lucide-bookmark"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.watching.empty') }}
            </p>
          </div>
        </template>

        <!-- Recent: placeholder -->
        <template v-else>
          <div class="p-6 text-center">
            <UIcon
              name="i-lucide-activity"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.recent.empty') }}
            </p>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
