<script lang="ts" setup>
import type { IssueDetail } from '~~/shared/types/issue-detail'

definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.issues',
})

const route = useRoute()
const apiFetch = useRequestFetch()

const number = computed(() => Number(route.params.id))
const repo = computed(() => route.query.repo as string | undefined)

const { data: issue, status, error } = useAsyncData(
  `issue-${repo.value}-${number.value}`,
  () => {
    if (!repo.value || !number.value) {
      throw createError({ statusCode: 400, message: 'Missing repo or issue number' })
    }
    return apiFetch<IssueDetail>(`/api/issues/${number.value}`, {
      params: { repo: repo.value },
    })
  },
)

const linkedPrs = computed(() => {
  if (!issue.value) return []
  return issue.value.timeline
    .filter(item => item.type === 'CrossReferencedEvent' && item.source.type === 'PullRequest')
    .map((item) => {
      if (item.type !== 'CrossReferencedEvent') return null
      return {
        number: item.source.number,
        title: item.source.title,
        url: item.source.url,
        state: item.source.state,
        actor: item.actor,
      }
    })
    .filter(Boolean) as Array<{ number: number, title: string, url: string, state: string, actor: string }>
})
</script>

<template>
  <div class="p-4">
    <IssueHeader
      v-if="issue"
      :issue="issue"
      :repo="repo!"
      :linked-prs="linkedPrs"
    />

    <div
      v-if="status === 'pending'"
      class="py-8 text-center text-muted"
    >
      {{ $t('common.loading') }}
    </div>

    <div
      v-else-if="error"
      class="py-8 text-center text-muted"
    >
      {{ error.message }}
    </div>

    <div
      v-else-if="issue"
      class="flex flex-col gap-4"
    >
      <IssueBody
        :id="issue.id"
        :body="issue.body"
        :author="issue.author"
        :author-association="issue.authorAssociation"
        :created-at="issue.createdAt"
        :reactions="issue.reactionGroups"
      />

      <template
        v-for="item in issue.timeline"
        :key="item.type === 'IssueComment' ? item.id : item.createdAt"
      >
        <IssueComment
          v-if="item.type === 'IssueComment'"
          :comment="item"
        />
      </template>
    </div>
  </div>
</template>
