import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

interface FetchError {
  statusCode?: number
  status?: number
}

async function fetchStatus(url: string): Promise<number | undefined> {
  try {
    await $fetch(url)
    return undefined
  }
  catch (e) {
    const err = e as FetchError
    return err.statusCode ?? err.status
  }
}

describe('API auth middleware', async () => {
  await setup({})

  it('rejects unauthenticated requests to /api/user/profile', async () => {
    expect(await fetchStatus('/api/user/profile')).toBe(401)
  })

  it('rejects unauthenticated requests to /api/user/settings', async () => {
    expect(await fetchStatus('/api/user/settings')).toBe(401)
  })

  it('rejects unauthenticated requests to /api/user/emails', async () => {
    expect(await fetchStatus('/api/user/emails')).toBe(401)
  })

  it('rejects unauthenticated requests to /api/user/readme', async () => {
    expect(await fetchStatus('/api/user/readme')).toBe(401)
  })
})
