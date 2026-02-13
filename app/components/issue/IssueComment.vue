<script lang="ts" setup>
import type { TimelineComment } from '~~/shared/types/issue-detail'

const props = defineProps<{
  comment: TimelineComment
}>()

const localReactions = ref([...props.comment.reactionGroups])

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
  <div class="rounded-lg border border-default bg-default">
    <!-- Author bar -->
    <div class="px-4 py-2 border-b border-default bg-elevated/50 rounded-t-lg">
      <UserCard
        :login="comment.author.login"
        :avatar-url="comment.author.avatarUrl"
        :association="comment.authorAssociation"
        :date="comment.createdAt"
      />
    </div>

    <!-- Markdown body -->
    <div class="p-4">
      <UEditor
        :model-value="comment.body"
        content-type="markdown"
        :editable="false"
      />
      <IssueReactions
        :reactions="localReactions"
        :subject-id="comment.id"
        class="mt-3"
        @toggle="onToggle"
      />
    </div>
  </div>
</template>
