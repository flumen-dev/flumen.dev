<script setup lang="ts">
const props = defineProps<{
  owner: string
  repo: string
}>()

const { data: notifications, status } = useLazyFetch<RepoNotification[]>(
  `/api/repository/${props.owner}/${props.repo}/notifications`,
)

const typeIcon: Record<string, string> = {
  Issue: 'i-lucide-circle-dot',
  PullRequest: 'i-lucide-git-pull-request',
  Release: 'i-lucide-tag',
  Discussion: 'i-lucide-message-circle',
  CheckSuite: 'i-lucide-circle-check',
}

const typeColor: Record<string, string> = {
  Issue: 'text-rose-500',
  PullRequest: 'text-blue-500',
  Release: 'text-emerald-500',
  Discussion: 'text-purple-500',
  CheckSuite: 'text-amber-500',
}

const { t } = useI18n()

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'mention':
      return t('repos.reason.mention')
    case 'author':
      return t('repos.reason.author')
    case 'comment':
      return t('repos.reason.comment')
    case 'subscribed':
      return t('repos.reason.subscribed')
    case 'review_requested':
      return t('repos.reason.review_requested')
    case 'assign':
      return t('repos.reason.assign')
    case 'state_change':
      return t('repos.reason.state_change')
    case 'ci_activity':
      return t('repos.reason.ci_activity')
    case 'approval_requested':
      return t('repos.reason.approval_requested')
    case 'invitation':
      return t('repos.reason.invitation')
    case 'manual':
      return t('repos.reason.manual')
    case 'member_feature_requested':
      return t('repos.reason.member_feature_requested')
    case 'security_advisory_credit':
      return t('repos.reason.security_advisory_credit')
    case 'security_alert':
      return t('repos.reason.security_alert')
    case 'team_mention':
      return t('repos.reason.team_mention')
    default:
      return t('repos.reason.unknown')
  }
}
</script>

<template>
  <div class="rounded-md border border-default bg-default overflow-hidden">
    <!-- Section header -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/10 border-b border-default text-xs font-medium text-amber-400">
      <UIcon
        name="i-lucide-bell"
        class="size-3.5"
      />
      {{ $t('nav.notifications') }}
    </div>

    <!-- Loading -->
    <div
      v-if="status === 'pending'"
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('common.loading') }}
    </div>

    <!-- Notification rows -->
    <template v-else-if="notifications?.length">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="flex items-center gap-2.5 px-3 py-2.5 hover:bg-accented hover:border-l-2 hover:border-l-amber-400 hover:pl-2.5 transition-all border-b border-default last:border-b-0"
      >
        <!-- Type icon -->
        <UIcon
          :name="typeIcon[n.type] || 'i-lucide-bell'"
          :class="typeColor[n.type] || 'text-amber-400'"
          class="size-4 shrink-0"
        />

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <span class="text-sm text-highlighted truncate block">
            {{ n.title }}
          </span>
          <div class="flex items-center gap-2 mt-0.5 text-xs text-muted">
            <UBadge
              color="neutral"
              variant="subtle"
              size="xs"
            >
              {{ reasonLabel(n.reason) }}
            </UBadge>
            <span class="text-dimmed">
              {{ timeAgo(n.updatedAt) }}
            </span>
          </div>
        </div>

        <!-- Type badge -->
        <UBadge
          :color="n.type === 'Issue' ? 'error' : n.type === 'PullRequest' ? 'info' : 'neutral'"
          variant="subtle"
          size="xs"
          class="shrink-0"
        >
          {{ n.type }}
        </UBadge>
      </div>
    </template>

    <!-- Empty -->
    <div
      v-else
      class="px-3 py-2 text-xs text-dimmed"
    >
      {{ $t('repos.noResults') }}
    </div>
  </div>
</template>
