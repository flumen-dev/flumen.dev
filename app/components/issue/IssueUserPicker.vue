<script setup lang="ts">
interface PickerPerson {
  login: string
  avatarUrl: string
  name?: string | null
  count: number
}

const props = defineProps<{
  /** Filter prefix — `author` or `assignee`. */
  filterPrefix: 'author' | 'assignee'
  /** People sourced from currently-loaded issues, sorted by frequency desc. */
  people: PickerPerson[]
  /** Visible label when no selection is active. */
  placeholder: string
}>()

const store = useIssueStore()
const open = ref(false)

const currentValue = computed(() => {
  return store.activeFilters
    .find(f => f.startsWith(`${props.filterPrefix}:`))
    ?.slice(props.filterPrefix.length + 1) ?? null
})

const currentPerson = computed(() => {
  if (!currentValue.value) return null
  return props.people.find(p => p.login === currentValue.value) ?? {
    // Person isn't in the currently-loaded pool (e.g. filter set from a previous repo);
    // render with a placeholder avatar derived from the GitHub identicon endpoint.
    login: currentValue.value,
    avatarUrl: `https://github.com/${currentValue.value}.png?size=40`,
    count: 0,
  }
})

function pick(login: string) {
  if (currentValue.value === login) {
    store.setUniqueFilter(props.filterPrefix, null)
  }
  else {
    store.setUniqueFilter(props.filterPrefix, login)
  }
  open.value = false
}

function clear(event: Event) {
  event.stopPropagation()
  store.setUniqueFilter(props.filterPrefix, null)
}
</script>

<template>
  <UPopover v-model:open="open">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
      :class="currentValue
        ? 'bg-primary text-inverted'
        : 'bg-muted text-toned hover:bg-accented'"
    >
      <UAvatar
        v-if="currentPerson"
        :src="currentPerson.avatarUrl"
        :alt="currentPerson.login"
        size="3xs"
      />
      <UIcon
        v-else
        :name="filterPrefix === 'author' ? 'i-lucide-pencil-line' : 'i-lucide-user-check'"
        class="size-3.5"
      />
      <span>{{ currentPerson ? `@${currentPerson.login}` : placeholder }}</span>
      <UIcon
        v-if="currentValue"
        name="i-lucide-x"
        class="size-3 hover:opacity-80"
        @click="clear"
      />
    </button>

    <template #content>
      <div class="w-64 max-h-80 overflow-y-auto p-2">
        <p
          v-if="!people.length"
          class="text-xs text-muted px-1 py-2 text-center"
        >
          {{ $t('issues.filter.noPeople') }}
        </p>
        <div
          v-else
          class="grid grid-cols-1 gap-0.5"
        >
          <button
            v-for="person in people"
            :key="person.login"
            type="button"
            class="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-elevated transition-colors cursor-pointer text-left min-w-0"
            :class="currentValue === person.login ? 'bg-elevated' : ''"
            @click="pick(person.login)"
          >
            <UAvatar
              :src="person.avatarUrl"
              :alt="person.login"
              size="2xs"
            />
            <span class="flex-1 min-w-0 truncate">
              <span>@{{ person.login }}</span>
              <span
                v-if="person.name"
                class="ml-1.5 text-xs text-muted"
              >{{ person.name }}</span>
            </span>
            <UIcon
              v-if="currentValue === person.login"
              name="i-lucide-check"
              class="size-4 text-primary shrink-0"
            />
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
