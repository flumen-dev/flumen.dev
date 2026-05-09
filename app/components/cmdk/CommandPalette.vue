<script setup lang="ts">
import CommandItem from './CommandItem.vue'
import CommandScopeToggle from './CommandScopeToggle.vue'

const cmdk = useCmdkStore()
const { loggedIn } = useUserSession()
const inputRef = useTemplateRef<HTMLInputElement>('inputRef')
const listRef = useTemplateRef<HTMLDivElement>('listRef')

const LISTBOX_ID = 'cmdk-listbox'
const activeDescendantId = computed(() => {
  const item = cmdk.flatResults[cmdk.selectedIndex]
  return item ? `cmdk-result-${item.id}` : undefined
})

defineShortcuts({
  meta_k: { handler: () => { if (loggedIn.value) cmdk.togglePalette() }, usingInput: true },
  meta_shift_k: {
    handler: () => {
      if (!loggedIn.value) return
      if (cmdk.open) cmdk.setScope('global')
      else cmdk.openPalette('global')
    },
    usingInput: true,
  },
  escape: { handler: () => { if (cmdk.open) cmdk.closePalette() }, usingInput: true },
  arrowdown: { handler: () => { if (cmdk.open) cmdk.selectNext() }, usingInput: true },
  arrowup: { handler: () => { if (cmdk.open) cmdk.selectPrev() }, usingInput: true },
  enter: { handler: () => { if (cmdk.open) cmdk.executeSelected() }, usingInput: true },
})

watch(() => cmdk.open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  inputRef.value?.focus()
})

// Keep highlighted item in view
watch(() => cmdk.selectedIndex, async () => {
  if (!cmdk.open) return
  await nextTick()
  const el = listRef.value?.querySelector<HTMLElement>('[data-cmdk-selected="true"]')
  el?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="cmdk.open"
        class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] px-4"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('cmdk.placeholder')"
        @click.self="cmdk.closePalette()"
      >
        <div class="w-full max-w-2xl bg-default rounded-xl shadow-2xl border border-default overflow-hidden flex flex-col max-h-[70vh]">
          <!-- Input row -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-default">
            <UIcon
              v-if="!cmdk.liveLoading"
              name="i-lucide-search"
              class="size-5 text-muted shrink-0"
            />
            <UIcon
              v-else
              name="i-lucide-loader-circle"
              class="size-5 text-muted shrink-0 animate-spin"
            />
            <input
              ref="inputRef"
              :value="cmdk.query"
              type="text"
              role="combobox"
              :placeholder="$t('cmdk.placeholder')"
              autocomplete="off"
              spellcheck="false"
              :aria-expanded="cmdk.open"
              :aria-controls="LISTBOX_ID"
              :aria-activedescendant="activeDescendantId"
              class="flex-1 bg-transparent outline-none text-base text-default placeholder-muted"
              @input="cmdk.setQuery(($event.target as HTMLInputElement).value)"
            >
            <CommandScopeToggle />
          </div>

          <!-- Scope hint when global -->
          <div
            v-if="cmdk.scope === 'global'"
            class="px-4 py-1.5 text-[11px] text-muted bg-elevated/50 border-b border-default"
          >
            {{ $t('cmdk.scopeHintGlobal') }}
          </div>

          <!-- List -->
          <div
            :id="LISTBOX_ID"
            ref="listRef"
            role="listbox"
            class="flex-1 overflow-y-auto py-2"
          >
            <div
              v-if="cmdk.loading && !cmdk.flatResults.length"
              class="px-4 py-8 text-center text-muted text-sm"
            >
              {{ $t('cmdk.loading') }}
            </div>

            <div
              v-else-if="!cmdk.flatResults.length"
              class="px-4 py-8 text-center text-muted text-sm"
            >
              {{ $t('cmdk.noResults') }}
            </div>

            <div
              v-for="section in cmdk.sections"
              :key="section.key"
              class="mb-1"
            >
              <div class="px-4 py-1.5 text-[11px] font-medium text-muted uppercase tracking-wider">
                {{ section.label }}
              </div>
              <CommandItem
                v-for="result in section.results"
                :key="result.id"
                :result="result"
                :selected="cmdk.flatResults[cmdk.selectedIndex]?.id === result.id"
                @select="cmdk.execute(result)"
                @highlight="cmdk.highlightById(result.id)"
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-4 py-2 border-t border-default text-xs text-muted bg-elevated/50">
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <kbd class="bg-default px-1.5 py-0.5 rounded border border-default">↑↓</kbd>
                {{ $t('cmdk.footerNavigate') }}
              </span>
              <span class="flex items-center gap-1">
                <kbd class="bg-default px-1.5 py-0.5 rounded border border-default">↵</kbd>
                {{ $t('cmdk.footerSelect') }}
              </span>
            </div>
            <span class="flex items-center gap-1">
              <kbd class="bg-default px-1.5 py-0.5 rounded border border-default">esc</kbd>
              {{ $t('common.close').toLowerCase() }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
