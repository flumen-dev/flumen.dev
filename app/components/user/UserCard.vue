<script lang="ts" setup>
import type { AuthorAssociation } from '~~/shared/types/issue-detail'

const props = defineProps<{
  login: string
  avatarUrl: string
  association?: AuthorAssociation
  date?: string
}>()

const { t } = useI18n()
const { open: openProfile } = useUserProfileDialog()
const timeAgo = useTimeAgo(computed(() => props.date ?? ''))

const roleBadge = computed(() => {
  switch (props.association) {
    case 'OWNER':
      return { label: t('user.role.owner'), color: 'warning' as const, description: t('user.role.ownerDescription') }
    case 'MEMBER':
      return { label: t('user.role.member'), color: 'info' as const, description: t('user.role.memberDescription') }
    case 'COLLABORATOR':
      return { label: t('user.role.collaborator'), color: 'success' as const, description: t('user.role.collaboratorDescription') }
    case 'CONTRIBUTOR':
      return { label: t('user.role.contributor'), color: 'neutral' as const, description: t('user.role.contributorDescription') }
    default:
      return null
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 cursor-pointer hover:underline"
      @click.stop="openProfile(login)"
    >
      <UAvatar
        :src="avatarUrl"
        :alt="login"
        size="2xs"
      />
      <span class="text-sm font-medium text-highlighted">{{ login }}</span>
    </button>
    <UTooltip
      v-if="roleBadge"
      :text="roleBadge.description"
    >
      <UBadge
        :label="roleBadge.label"
        :color="roleBadge.color"
        variant="subtle"
        size="xs"
      />
    </UTooltip>
    <span
      v-if="date"
      class="text-xs text-muted"
    >
      {{ timeAgo }}
    </span>
  </div>
</template>
