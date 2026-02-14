<script lang="ts" setup>
import type { AuthorAssociation, ReactionGroup } from '~~/shared/types/issue-detail'

const props = defineProps<{
  id: string
  body: string
  author: { login: string, avatarUrl: string }
  authorAssociation: AuthorAssociation
  createdAt: string
  reactions: ReactionGroup[]
}>()

const enhancedBody = computed(() => linkifyMentions(props.body))
const localReactions = ref([...props.reactions])

function onToggle(content: string, added: boolean) {
  const idx = localReactions.value.findIndex(r => r.content === content)
  if (added && idx === -1) {
    localReactions.value.push({ content, count: 1, viewerHasReacted: true })
  }
  else if (added && idx >= 0) {
    localReactions.value[idx] = { ...localReactions.value[idx]!, count: localReactions.value[idx]!.count + 1, viewerHasReacted: true }
  }
  else if (!added && idx >= 0) {
    const current = localReactions.value[idx]!
    if (current.count <= 1) {
      localReactions.value.splice(idx, 1)
    }
    else {
      localReactions.value[idx] = { ...current, count: current.count - 1, viewerHasReacted: false }
    }
  }
}
</script>

<template>
  <div
    :id="`comment-${id}`"
    class="rounded-lg border border-default bg-default"
  >
    <!-- Author bar -->
    <div class="px-4 py-2 border-b border-default bg-elevated/50 rounded-t-lg">
      <UserCard
        :login="author.login"
        :avatar-url="author.avatarUrl"
        :association="authorAssociation"
        :date="createdAt"
      />
    </div>

    <!-- Markdown body -->
    <div class="p-4">
      <UEditor
        :model-value="enhancedBody"
        content-type="markdown"
        :editable="false"
        :mention="false"
        :extensions="[LinkEnhancer]"
      />
      <IssueReactions
        :reactions="localReactions"
        :subject-id="id"
        class="mt-3"
        @toggle="onToggle"
      />
    </div>
  </div>
</template>
