<script setup lang="ts">
import type { PullDetail } from '~~/shared/types/pull-detail'
import { buildWorkItemPath } from '~/utils/workItemPath'

definePageMeta({
  middleware: 'auth',
  titleKey: 'nav.pullRequests',
})

const route = useRoute()
const localePath = useLocalePath()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)
const number = computed(() => Number(route.params.id))
const validNumber = computed(() => {
  if (!Number.isFinite(number.value) || !Number.isInteger(number.value) || number.value <= 0) {
    return null
  }
  return number.value
})
const repoFullName = computed(() => `${owner.value}/${repo.value}`)

function linkedIssueTo(number: number) {
  const path = buildWorkItemPath(repoFullName.value, number)
  return localePath(path ?? `/repos/${owner.value}/${repo.value}/work-items/${number}`)
}

const { data: pull, status, error } = await useAsyncData<PullDetail>(
  () => validNumber.value === null
    ? `repo-pull-${owner.value}-${repo.value}-invalid`
    : `repo-pull-${owner.value}-${repo.value}-${validNumber.value}`,
  async () => {
    if (validNumber.value === null) {
      throw createError({ statusCode: 404, statusMessage: 'Invalid pull ID' })
    }

    return $fetch<PullDetail>(`/api/repository/${owner.value}/${repo.value}/pulls/${validNumber.value}`)
  },
  {
    watch: [owner, repo, validNumber],
  },
)
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center gap-2">
      <NuxtLinkLocale
        :to="`/repos/${owner}/${repo}/pulls`"
        class="text-sm font-semibold text-highlighted hover:text-primary transition-colors"
      >
        {{ repoFullName }}
      </NuxtLinkLocale>
      <span class="text-sm text-muted">/</span>
      <span class="font-mono text-sm text-muted">#{{ number }}</span>
    </div>

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

    <template v-else-if="pull">
      <UCard>
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-semibold text-highlighted">
                {{ pull.title }}
              </h1>
              <div class="mt-1 flex items-center gap-2 text-sm text-muted">
                <span>#{{ pull.number }}</span>
                <span>•</span>
                <span>{{ pull.state.toLowerCase() }}</span>
                <UBadge
                  v-if="pull.isDraft"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                >
                  {{ $t('repos.badge.draft') }}
                </UBadge>
              </div>
            </div>

            <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-external-link"
              :to="pull.url"
              target="_blank"
            >
              {{ $t('common.viewOnGithub') }}
            </UButton>
          </div>

          <div class="flex items-center gap-2 text-sm text-muted">
            <NuxtImg
              :src="pull.author.avatarUrl"
              :alt="pull.author.login"
              class="size-4 rounded-full"
              width="16"
              height="16"
            />
            <span>{{ pull.author.login }}</span>
            <span>•</span>
            <span>{{ timeAgo(pull.updatedAt) }}</span>
          </div>

          <UiMarkdownRenderer
            :source="pull.body || ''"
            :repo-context="repoFullName"
            :breaks="false"
            :linkify-mentions="true"
          />
        </div>
      </UCard>

      <UCard v-if="pull.linkedIssues.length">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-link"
              class="size-4 text-primary"
            />
            <span class="text-sm font-medium">{{ $t('repos.detail.linkedIssues') }}</span>
          </div>
        </template>

        <div class="space-y-2">
          <NuxtLinkLocale
            v-for="linkedIssue in pull.linkedIssues"
            :key="linkedIssue.number"
            :to="linkedIssueTo(linkedIssue.number)"
            class="block text-sm text-highlighted hover:text-primary transition-colors"
          >
            #{{ linkedIssue.number }} · {{ linkedIssue.title }}
          </NuxtLinkLocale>
        </div>
      </UCard>
    </template>
  </div>
</template>
