<script setup lang="ts">
const props = defineProps<{
  type: BookmarkType
  /** `owner/name` for issue/pr/repo. */
  repo: string
  /** Required for issue/pr; ignored for repo. */
  number?: number
  title: string
  /** Internal app path to navigate when the bookmark is opened later. */
  url: string
  avatarUrl?: string
}>()

const { t } = useI18n()
const store = useBookmarkStore()
store.loadIfNeeded()

const id = computed(() =>
  props.type === 'repo'
    ? bookmarkId('repo', props.repo)
    : bookmarkId(props.type, props.repo, props.number!),
)
const active = computed(() => store.isBookmarked(id.value))

function toggle(event: Event) {
  event.stopPropagation()
  event.preventDefault()
  store.toggleBookmark({
    type: props.type,
    id: id.value,
    title: props.title,
    repo: props.repo,
    number: props.number,
    url: props.url,
    avatarUrl: props.avatarUrl,
  })
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="active"
    :aria-label="active ? t('bookmark.remove') : t('bookmark.add')"
    :title="active ? t('bookmark.remove') : t('bookmark.add')"
    class="inline-flex items-center justify-center size-7 rounded-md transition-colors cursor-pointer"
    :class="active
      ? 'text-warning hover:bg-warning/10'
      : 'text-muted hover:text-highlighted hover:bg-elevated'"
    @click="toggle"
  >
    <UIcon
      :name="active ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
      class="size-4"
    />
  </button>
</template>
