<script setup lang="ts">
definePageMeta({
  titleKey: 'nav.focus',
  middleware: 'auth',
})

const { t } = useI18n()
const store = useFocusStore()
const localePath = useLocalePath()

const sections = [
  { key: 'workingOn' as const, icon: 'i-lucide-hammer', emptyIcon: 'i-lucide-hard-hat' },
  { key: 'created' as const, icon: 'i-lucide-pen-line', emptyIcon: 'i-lucide-file-text' },
  { key: 'watching' as const, icon: 'i-lucide-eye', emptyIcon: 'i-lucide-bookmark' },
  { key: 'recent' as const, icon: 'i-lucide-clock', emptyIcon: 'i-lucide-activity' },
] as const

type SectionKey = typeof sections[number]['key']

function sectionState(key: SectionKey) {
  return store[key]
}

function sectionCount(key: SectionKey): number | null {
  const state = sectionState(key)
  if (!state.fetchedAt) return null
  if (key === 'created') return store.createdTotalCount
  return state.data.length
}
</script>

<template>
  <div class="p-4 space-y-4">
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
        <UBadge
          v-if="sectionCount(s.key) != null && sectionCount(s.key)! > 0"
          :label="String(sectionCount(s.key))"
          color="neutral"
          variant="subtle"
          size="sm"
        />

        <!-- Created: state filter chips (inside header, right of count) -->
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
        <!-- Working On -->
        <template v-if="s.key === 'workingOn'">
          <div
            v-if="store.workingOn.loading && !store.workingOn.data.length"
            class="p-6 text-center"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="size-6 text-dimmed mx-auto mb-2 animate-spin"
            />
            <p class="text-sm text-muted">
              {{ t('common.loading') }}
            </p>
          </div>

          <div
            v-else-if="store.workingOn.data.length === 0"
            class="p-6 text-center"
          >
            <UIcon
              name="i-lucide-hard-hat"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.workingOn.empty') }}
            </p>
          </div>

          <div v-else>
            <NuxtLink
              v-for="item in store.workingOn.data"
              :key="`${item.repo}#${item.number}`"
              :to="item.type === 'issue' ? localePath({ path: `/issues/${item.number}`, query: { repo: item.repo } }) : item.url"
              :external="item.type === 'pr'"
              :target="item.type === 'pr' ? '_blank' : undefined"
              class="flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors border-b border-default last:border-b-0"
            >
              <UIcon
                :name="item.type === 'issue' ? 'i-lucide-circle-dot' : 'i-lucide-git-pull-request'"
                class="size-4 mt-0.5 shrink-0"
                :class="item.type === 'issue' ? 'text-emerald-500' : (item.isDraft ? 'text-neutral-400' : 'text-blue-500')"
              />

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-highlighted truncate">
                    {{ item.title }}
                  </span>
                  <span class="text-xs text-dimmed shrink-0">
                    #{{ item.number }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-muted">
                    {{ item.repo }}
                  </span>
                  <UBadge
                    v-if="item.isDraft"
                    :label="$t('repos.badge.draft')"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  />
                  <UBadge
                    v-for="label in item.labels.slice(0, 3)"
                    :key="label.name"
                    :label="label.name"
                    :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
                    variant="subtle"
                    size="xs"
                  />
                </div>
              </div>

              <UBadge
                v-if="item.branchName"
                :label="item.branchName"
                color="neutral"
                variant="outline"
                size="xs"
                class="shrink-0 max-w-40 truncate"
              />
            </NuxtLink>
          </div>
        </template>

        <!-- Created -->
        <template v-else-if="s.key === 'created'">
          <!-- Skeleton loading -->
          <div v-if="store.created.loading && !store.created.data.length">
            <FocusCardSkeleton
              v-for="i in 10"
              :key="i"
            />
          </div>

          <!-- Empty state -->
          <div
            v-else-if="store.created.data.length === 0"
            class="p-6 text-center"
          >
            <UIcon
              name="i-lucide-file-text"
              class="size-8 text-dimmed mx-auto mb-2"
            />
            <p class="text-sm text-muted">
              {{ t('focus.created.empty') }}
            </p>
          </div>

          <!-- Items + pagination -->
          <div v-else>
            <div
              class="transition-opacity duration-200"
              :class="store.createdPaging ? 'opacity-50 pointer-events-none' : ''"
            >
              <FocusCreatedIssueCard
                v-for="item in store.created.data"
                :key="item.id"
                :item="item"
              />
            </div>

            <UiPaginator
              :current-page="store.createdPage"
              :total-pages="store.createdTotalPages"
              :has-more="store.createdHasMore"
              :has-previous="store.createdHasPrevious"
              :paging="store.createdPaging"
              @next="store.createdNextPage()"
              @previous="store.createdPrevPage()"
            />
          </div>
        </template>

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
