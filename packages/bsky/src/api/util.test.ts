import { describe, expect, it, vi } from 'vitest'
import { fillPage } from './util.js'

describe('fillPage', () => {
  it('returns a terminal short page without refilling', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ items: [1], cursor: undefined, metadata: 'first' })

    await expect(
      fillPage({ cursor: undefined, limit: 3, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [1], cursor: undefined, metadata: 'first' })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith({ cursor: undefined, limit: 3 })
  })

  it('fills across filtered and empty pages', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], cursor: 'a', metadata: 'first' })
      .mockResolvedValueOnce({ items: [], cursor: 'b' })
      .mockResolvedValueOnce({ items: [2, 3], cursor: 'c' })

    await expect(
      fillPage({ cursor: 'start', limit: 3, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [1, 2, 3], cursor: 'c', metadata: 'first' })
    expect(fetch).toHaveBeenNthCalledWith(1, { cursor: 'start', limit: 3 })
    expect(fetch).toHaveBeenNthCalledWith(2, { cursor: 'a', limit: 2 })
    expect(fetch).toHaveBeenNthCalledWith(3, { cursor: 'b', limit: 2 })
  })

  it('preserves the cursor when the request bound is reached', async () => {
    const fetch = vi.fn(async ({ cursor }: { cursor?: string }) => ({
      items: [],
      cursor: `${cursor ?? ''}x`,
    }))

    const result = await fillPage({
      cursor: 'a',
      limit: 1,
      fetch,
      items: (r) => r.items,
    })

    expect(fetch).toHaveBeenCalledTimes(10)
    expect(result).toEqual({ items: [], cursor: 'axxxxxxxxxx' })
  })

  it('accepts a custom request bound', async () => {
    const fetch = vi.fn(async ({ cursor }: { cursor?: string }) => ({
      items: [],
      cursor: `${cursor ?? ''}x`,
    }))

    const result = await fillPage({
      cursor: 'a',
      limit: 1,
      maxRequests: 2,
      fetch,
      items: (r) => r.items,
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ items: [], cursor: 'axx' })
  })

  it('stops on a repeated cursor', async () => {
    const fetch = vi.fn().mockResolvedValue({ items: [], cursor: 'a' })

    await expect(
      fillPage({ cursor: undefined, limit: 1, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [], cursor: undefined })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
