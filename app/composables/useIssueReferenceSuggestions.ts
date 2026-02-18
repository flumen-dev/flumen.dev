import type { EditorSuggestionMenuItem } from '@nuxt/ui'
import type { RepoIssue } from '~~/shared/types/repository'

type IssueReferenceSuggestionItem = EditorSuggestionMenuItem<{
  issueReference: {
    canExecute: (editor: unknown, cmd?: { number?: number }) => boolean
    execute: (editor: unknown, cmd?: { number?: number }) => unknown
    isActive: (editor: unknown, cmd?: { number?: number }) => boolean
  }
}> & {
  kind: 'issueReference'
  number: number
}

export function useIssueReferenceSuggestions(repoContext: Ref<string | undefined>) {
  const requestFetch = useRequestFetch()
  const issueSuggestionItems = ref<IssueReferenceSuggestionItem[]>([])

  watch(repoContext, async (repoValue) => {
    if (!repoValue) {
      issueSuggestionItems.value = []
      return
    }

    const [owner, repo] = repoValue.split('/')
    if (!owner || !repo) {
      issueSuggestionItems.value = []
      return
    }

    try {
      const encodedOwner = encodeURIComponent(owner)
      const encodedRepo = encodeURIComponent(repo)
      const issues = await requestFetch<RepoIssue[]>(`/api/repository/${encodedOwner}/${encodedRepo}/issues`)

      issueSuggestionItems.value = issues.map(issue => ({
        kind: 'issueReference',
        number: issue.number,
        label: `#${issue.number}`,
        description: issue.title,
        icon: 'i-lucide-hash',
      }))
    }
    catch {
      issueSuggestionItems.value = []
    }
  }, { immediate: true })

  return {
    issueSuggestionItems,
  }
}
