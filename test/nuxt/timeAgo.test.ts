import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

async function callTimeAgo(isoDate: string): Promise<string> {
  let result = ''
  const Wrapper = defineComponent({
    setup() {
      result = timeAgo(isoDate)
      return () => h('span', result)
    },
  })
  await mountSuspended(Wrapper)
  return result
}

describe('timeAgo', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', async () => {
    expect(await callTimeAgo(ago(30 * SEC))).toBe('just now')
  })

  it('returns minutes at the 60-second boundary', async () => {
    expect(await callTimeAgo(ago(60 * SEC))).toBe('1 min ago')
  })

  it('returns hours at the 60-minute boundary', async () => {
    expect(await callTimeAgo(ago(60 * MIN))).toBe('1h ago')
  })

  it('returns days at the 24-hour boundary', async () => {
    expect(await callTimeAgo(ago(24 * HOUR))).toBe('1d ago')
  })

  it('returns months at the 30-day boundary', async () => {
    expect(await callTimeAgo(ago(30 * DAY))).toBe('1 month ago')
  })

  it('returns years at the 12-month boundary', async () => {
    expect(await callTimeAgo(ago(360 * DAY))).toBe('1 year ago')
  })

  it('handles multi-unit values correctly', async () => {
    expect(await callTimeAgo(ago(5 * HOUR))).toBe('5h ago')
  })
})
