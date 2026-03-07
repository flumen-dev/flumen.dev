<script setup lang="ts">
interface RepoLabel { name: string, color: string, description: string | null }

const props = defineProps<{
  repo: string
  number: number
  labels: Array<{ name: string, color: string }>
  readonly?: boolean
}>()

const emit = defineEmits<{
  added: [label: { name: string, color: string }]
  removed: [name: string]
}>()

const { t } = useI18n()
const apiFetch = useRequestFetch()
const adding = ref(false)
const searchValue = ref('')
const loading = ref(false)

const repoLabelsCache = useState<Record<string, { data: RepoLabel[], fetchedAt: number }>>('repo-labels-cache', () => ({}))

async function fetchRepoLabels(repo: string): Promise<RepoLabel[]> {
  const cached = repoLabelsCache.value[repo]
  if (cached && Date.now() - cached.fetchedAt < 15 * 60 * 1000) return cached.data

  try {
    const [owner, repoName] = repo.split('/')
    const res = await apiFetch<RepoLabel[]>(`/api/repository/${owner}/${repoName}/labels`)
    repoLabelsCache.value[repo] = { data: res, fetchedAt: Date.now() }
    return res
  }
  catch {
    return []
  }
}

const repoLabels = ref<RepoLabel[]>([])

async function startAdding() {
  adding.value = true
  repoLabels.value = await fetchRepoLabels(props.repo)
}

const availableLabels = computed(() => {
  const currentNames = new Set(props.labels.map(l => l.name))
  const search = searchValue.value.toLowerCase()
  return repoLabels.value
    .filter(l => !currentNames.has(l.name))
    .filter(l => !search || l.name.toLowerCase().includes(search))
})

function cancelAdding() {
  adding.value = false
  searchValue.value = ''
}

async function removeLabel(name: string) {
  loading.value = true
  try {
    await apiFetch('/api/issues/labels', {
      method: 'POST',
      body: { repo: props.repo, number: props.number, action: 'remove', label: name },
    })
    emit('removed', name)
  }
  catch {
    // silent
  }
  finally {
    loading.value = false
  }
}

async function addLabel(label: { name: string, color: string }) {
  loading.value = true
  try {
    await apiFetch('/api/issues/labels', {
      method: 'POST',
      body: { repo: props.repo, number: props.number, action: 'add', label: label.name },
    })
    emit('added', label)
    searchValue.value = ''
    adding.value = false
  }
  catch {
    // silent
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex items-center gap-1 flex-wrap"
    @click.stop.prevent="() => {}"
    @mousedown.stop
  >
    <span
      v-for="label in labels"
      :key="label.name"
      class="group/label inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-none transition-all duration-150"
      :class="!readonly ? 'hover:pr-1' : ''"
      :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
    >
      {{ label.name }}
      <button
        v-if="!readonly"
        type="button"
        :aria-label="t('common.removeItem', { item: label.name })"
        class="inline-flex items-center justify-center max-w-0 overflow-hidden opacity-0 group-hover/label:max-w-4 group-hover/label:opacity-100 group-hover/label:ml-0.5 focus-visible:max-w-4 focus-visible:opacity-100 focus-visible:ml-0.5 transition-all duration-150 cursor-pointer"
        :disabled="loading"
        @click.stop="removeLabel(label.name)"
      >
        <UIcon
          name="i-lucide-x"
          class="size-3 shrink-0"
        />
      </button>
    </span>

    <template v-if="!readonly">
      <UPopover
        v-if="adding"
        :open="adding"
        @update:open="(v: boolean) => { if (!v) cancelAdding() }"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center size-5 rounded-full border border-dashed border-primary text-primary cursor-pointer"
          @click.stop="cancelAdding"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-3"
          />
        </button>

        <template #content>
          <div class="w-56 p-2">
            <input
              v-model="searchValue"
              type="text"
              class="w-full px-2 py-1 text-xs rounded border border-default bg-default focus:outline-none focus:ring-1 focus:ring-primary mb-2"
              :placeholder="t('common.filterLabels')"
              @click.stop
              @keydown.escape="cancelAdding"
            >
            <div class="max-h-48 overflow-y-auto space-y-0.5">
              <button
                v-for="label in availableLabels"
                :key="label.name"
                type="button"
                class="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-elevated transition-colors cursor-pointer text-left"
                :disabled="loading"
                @click.stop="addLabel(label)"
              >
                <span
                  class="size-3 rounded-full shrink-0"
                  :style="{ backgroundColor: `#${label.color}` }"
                />
                <span class="truncate">{{ label.name }}</span>
              </button>
              <p
                v-if="availableLabels.length === 0"
                class="text-xs text-muted px-2 py-1"
              >
                {{ t('common.noLabelsAvailable') }}
              </p>
            </div>
          </div>
        </template>
      </UPopover>
      <button
        v-else
        type="button"
        class="inline-flex items-center justify-center size-5 rounded-full border border-dashed border-default text-muted hover:text-highlighted hover:border-primary transition-colors cursor-pointer"
        :disabled="loading"
        @click.stop="startAdding"
      >
        <UIcon
          name="i-lucide-plus"
          class="size-3"
        />
      </button>
    </template>
  </div>
</template>
