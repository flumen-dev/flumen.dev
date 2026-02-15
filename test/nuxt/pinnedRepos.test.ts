import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { readBody as h3ReadBody } from 'h3'
import { defaultUserSettings, type UserSettings } from '../../shared/types/settings'

let storedSettings: UserSettings = { ...defaultUserSettings }

registerEndpoint('/api/user/settings', {
  method: 'GET',
  handler: () => ({ ...storedSettings }),
})

registerEndpoint('/api/user/settings', {
  method: 'PUT',
  handler: async (event) => {
    const body = await h3ReadBody(event)
    storedSettings = { ...storedSettings, ...body }
    return { ...storedSettings }
  },
})

async function withPinned<T>(fn: (pinned: ReturnType<typeof usePinnedRepos>) => T | Promise<T>): Promise<T> {
  let result: T
  storedSettings = { ...defaultUserSettings }
  const Wrapper = defineComponent({
    async setup() {
      const { settings, load } = useUserSettings()
      settings.value = { ...defaultUserSettings }
      await load()
      const pinned = usePinnedRepos()
      result = await fn(pinned)
      return () => h('div')
    },
  })
  await mountSuspended(Wrapper)
  return result!
}

describe('usePinnedRepos', () => {
  it('pins a repo and persists it', async () => {
    await withPinned(async (pinned) => {
      expect(pinned.isPinned('org/repo')).toBe(false)
      await pinned.pin('org/repo')
      expect(pinned.isPinned('org/repo')).toBe(true)
      expect(pinned.pinnedRepos.value).toEqual([{ repo: 'org/repo', type: 'repo' }])
    })
  })

  it('pins a fork with correct type', async () => {
    await withPinned(async (pinned) => {
      await pinned.pin('org/repo', 'fork')
      expect(pinned.pinnedRepos.value).toEqual([{ repo: 'org/repo', type: 'fork' }])
      expect(pinned.getItem('org/repo')?.type).toBe('fork')
    })
  })

  it('unpins a repo', async () => {
    await withPinned(async (pinned) => {
      await pinned.pin('org/repo')
      await pinned.pin('org/other')
      expect(pinned.pinnedRepos.value).toHaveLength(2)
      await pinned.unpin('org/repo')
      expect(pinned.pinnedRepos.value).toEqual([{ repo: 'org/other', type: 'repo' }])
      expect(pinned.isPinned('org/repo')).toBe(false)
    })
  })

  it('toggle pins and unpins', async () => {
    await withPinned(async (pinned) => {
      await pinned.toggle('org/repo')
      expect(pinned.isPinned('org/repo')).toBe(true)
      await pinned.toggle('org/repo')
      expect(pinned.isPinned('org/repo')).toBe(false)
    })
  })

  it('reorders pinned repos', async () => {
    await withPinned(async (pinned) => {
      await pinned.pin('org/a')
      await pinned.pin('org/b')
      await pinned.pin('org/c')
      await pinned.reorder([
        { repo: 'org/c', type: 'repo' },
        { repo: 'org/a', type: 'repo' },
        { repo: 'org/b', type: 'repo' },
      ])
      expect(pinned.pinnedRepos.value.map(p => p.repo)).toEqual(['org/c', 'org/a', 'org/b'])
    })
  })

  it('does not duplicate when pinning twice', async () => {
    await withPinned(async (pinned) => {
      await pinned.pin('org/repo')
      await pinned.pin('org/repo')
      expect(pinned.pinnedRepos.value).toEqual([{ repo: 'org/repo', type: 'repo' }])
    })
  })
})
