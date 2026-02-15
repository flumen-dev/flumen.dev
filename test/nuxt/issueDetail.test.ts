import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import { readBody as h3ReadBody } from 'h3'
import type { IssueDetail, TimelineComment } from '../../shared/types/issue-detail'

const mockComment: TimelineComment = {
  type: 'IssueComment',
  id: 'IC_1',
  body: 'First comment',
  bodyHTML: '<p>First comment</p>',
  authorAssociation: 'NONE',
  author: { login: 'alice', avatarUrl: 'https://a.com/alice.png' },
  createdAt: '2025-06-01T00:00:00Z',
  updatedAt: '2025-06-01T00:00:00Z',
  reactionGroups: [],
}

const mockIssue: IssueDetail = {
  id: 'I_1',
  number: 42,
  title: 'Test issue',
  body: 'Issue body',
  bodyHTML: '<p>Issue body</p>',
  state: 'OPEN',
  stateReason: null,
  url: 'https://github.com/org/repo/issues/42',
  createdAt: '2025-06-01T00:00:00Z',
  updatedAt: '2025-06-02T00:00:00Z',
  closedAt: null,
  locked: false,
  authorAssociation: 'OWNER',
  author: { login: 'alice', avatarUrl: 'https://a.com/alice.png' },
  labels: [{ name: 'bug', color: 'ff0000' }],
  assignees: [],
  milestone: null,
  reactionGroups: [],
  timeline: [mockComment],
}

// --- Mock endpoints ---

registerEndpoint('/api/issues/42', {
  method: 'GET',
  handler: () => ({ ...mockIssue }),
})

registerEndpoint('/api/issues/body', {
  method: 'PATCH',
  handler: async (event) => {
    const { id, body } = await h3ReadBody(event)
    return { id, body, bodyHTML: `<p>${body}</p>`, updatedAt: '2025-06-03T00:00:00Z' }
  },
})

registerEndpoint('/api/issues/comments', {
  method: 'POST',
  handler: async (event) => {
    const { body } = await h3ReadBody(event)
    return {
      type: 'IssueComment',
      id: 'IC_new',
      body,
      bodyHTML: `<p>${body}</p>`,
      authorAssociation: 'NONE',
      author: { login: 'alice', avatarUrl: 'https://a.com/alice.png' },
      createdAt: '2025-06-03T00:00:00Z',
      updatedAt: '2025-06-03T00:00:00Z',
      reactionGroups: [],
    } satisfies TimelineComment
  },
})

registerEndpoint('/api/issues/comments', {
  method: 'PATCH',
  handler: async (event) => {
    const { id, body } = await h3ReadBody(event)
    return { id, body, bodyHTML: `<p>${body}</p>`, updatedAt: '2025-06-03T00:00:00Z' }
  },
})

registerEndpoint('/api/issues/comments', {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

// --- Helper ---

type IssueDetailReturn = ReturnType<typeof useIssueDetail>

async function withIssueDetail<T>(fn: (detail: IssueDetailReturn) => T | Promise<T>): Promise<T> {
  let result: T
  const Wrapper = defineComponent({
    async setup() {
      // Clear cached data from previous test runs
      const nuxtApp = useNuxtApp()
      const cacheKey = 'issue-org/repo-42'
      nuxtApp.payload.data[cacheKey] = undefined
      nuxtApp.static.data[cacheKey] = undefined
      clearNuxtData()

      const repo = ref<string | undefined>('org/repo')
      const number = ref(42)
      const detail = useIssueDetail(repo, number)
      // Wait for initial fetch
      while (detail.status.value === 'pending') {
        await new Promise(r => setTimeout(r, 10))
      }
      result = await fn(detail)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('useIssueDetail', () => {
  it('fetches issue on mount', async () => {
    await withIssueDetail((detail) => {
      expect(detail.issue.value).toBeTruthy()
      expect(detail.issue.value!.title).toBe('Test issue')
      expect(detail.issue.value!.timeline).toHaveLength(1)
    })
  })

  // --- saveBody ---

  it('saveBody updates issue body and returns result', async () => {
    await withIssueDetail(async (detail) => {
      const result = await detail.saveBody('Updated body')
      expect(result).toBeTruthy()
      expect(result!.body).toBe('Updated body')
      expect(detail.issue.value!.body).toBe('Updated body')
      expect(detail.issue.value!.bodyHTML).toBe('<p>Updated body</p>')
      expect(detail.issue.value!.updatedAt).toBe('2025-06-03T00:00:00Z')
    })
  })

  it('saveBody preserves other issue fields', async () => {
    await withIssueDetail(async (detail) => {
      await detail.saveBody('New body')
      expect(detail.issue.value!.title).toBe('Test issue')
      expect(detail.issue.value!.timeline).toHaveLength(1)
      expect(detail.issue.value!.labels).toHaveLength(1)
    })
  })

  // --- submitComment ---

  it('submitComment appends comment to timeline', async () => {
    await withIssueDetail(async (detail) => {
      const comment = await detail.submitComment('I_1', 'New comment')
      expect(comment).toBeTruthy()
      expect(comment!.id).toBe('IC_new')
      expect(comment!.body).toBe('New comment')
      expect(detail.issue.value!.timeline).toHaveLength(2)
      const last = detail.issue.value!.timeline[1]!
      expect(last.type).toBe('IssueComment')
      expect((last as TimelineComment).body).toBe('New comment')
    })
  })

  it('submitComment preserves existing timeline items', async () => {
    await withIssueDetail(async (detail) => {
      await detail.submitComment('I_1', 'Another comment')
      expect(detail.issue.value!.timeline[0]!.type).toBe('IssueComment')
      expect((detail.issue.value!.timeline[0] as TimelineComment).id).toBe('IC_1')
    })
  })

  // --- saveComment ---

  it('saveComment updates existing comment in timeline', async () => {
    await withIssueDetail(async (detail) => {
      const result = await detail.saveComment('IC_1', 'Edited comment')
      expect(result).toBeTruthy()
      expect(result!.body).toBe('Edited comment')
      const comment = detail.issue.value!.timeline[0] as TimelineComment
      expect(comment.body).toBe('Edited comment')
      expect(comment.bodyHTML).toBe('<p>Edited comment</p>')
    })
  })

  it('saveComment does not affect other comments', async () => {
    await withIssueDetail(async (detail) => {
      // Add a second comment first
      await detail.submitComment('I_1', 'Second')
      // Edit the first one
      await detail.saveComment('IC_1', 'Edited')
      expect(detail.issue.value!.timeline).toHaveLength(2)
      expect((detail.issue.value!.timeline[1] as TimelineComment).body).toBe('Second')
    })
  })

  // --- removeComment ---

  it('removeComment removes comment from timeline', async () => {
    await withIssueDetail(async (detail) => {
      expect(detail.issue.value!.timeline).toHaveLength(1)
      await detail.removeComment('IC_1')
      expect(detail.issue.value!.timeline).toHaveLength(0)
    })
  })

  it('removeComment only removes the targeted comment', async () => {
    await withIssueDetail(async (detail) => {
      await detail.submitComment('I_1', 'Keep me')
      expect(detail.issue.value!.timeline).toHaveLength(2)
      await detail.removeComment('IC_1')
      expect(detail.issue.value!.timeline).toHaveLength(1)
      expect((detail.issue.value!.timeline[0] as TimelineComment).id).toBe('IC_new')
    })
  })

  // --- editingId lock ---

  it('editingId defaults to null', async () => {
    await withIssueDetail((detail) => {
      expect(detail.editingId.value).toBeNull()
    })
  })

  it('editingId can be set and cleared', async () => {
    await withIssueDetail((detail) => {
      detail.editingId.value = 'IC_1'
      expect(detail.editingId.value).toBe('IC_1')
      detail.editingId.value = null
      expect(detail.editingId.value).toBeNull()
    })
  })
})
