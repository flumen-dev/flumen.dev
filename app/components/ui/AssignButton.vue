<script setup lang="ts">
const props = defineProps<{
  repo: string
  number: number
  assignees: Array<{ login: string, avatarUrl: string }>
}>()

const emit = defineEmits<{
  assigned: [login: string]
  unassigned: [login: string]
}>()

const { t } = useI18n()
const { user } = useUserSession()
const apiFetch = useRequestFetch()
const toast = useToast()
const loading = ref(false)

const myLogin = computed(() => user.value?.login)
const isAssigned = computed(() => props.assignees.some(a => a.login === myLogin.value))

async function toggle() {
  if (!myLogin.value) return
  loading.value = true

  const action = isAssigned.value ? 'remove' : 'add'

  try {
    await apiFetch('/api/issues/assignees', {
      method: 'POST',
      body: { repo: props.repo, number: props.number, action, login: myLogin.value },
    })

    if (action === 'add') {
      emit('assigned', myLogin.value)
    }
    else {
      emit('unassigned', myLogin.value)
    }
  }
  catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UTooltip :text="isAssigned ? t('focus.inbox.unassignMe') : t('focus.inbox.assignMe')">
    <button
      type="button"
      :aria-label="isAssigned ? t('focus.inbox.unassignMe') : t('focus.inbox.assignMe')"
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer"
      :class="isAssigned
        ? 'bg-primary/15 text-primary'
        : 'bg-muted/50 text-muted hover:text-highlighted hover:bg-muted'"
      :disabled="loading || !myLogin"
      @click.stop="toggle"
    >
      <UIcon
        :name="loading ? 'i-lucide-loader-2' : (isAssigned ? 'i-lucide-user-check' : 'i-lucide-user-plus')"
        class="size-3.5"
        :class="loading ? 'animate-spin' : ''"
      />
    </button>
  </UTooltip>
</template>
