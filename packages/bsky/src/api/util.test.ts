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
      .mockResolvedValueOnce({ items: [], cursor: 'a', metadata: 'first' })
      .mockResolvedValueOnce({ items: [], cursor: 'b' })
      .mockResolvedValueOnce({ items: [1, 2], cursor: 'c' })

    await expect(
      fillPage({ cursor: 'start', limit: 3, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [1, 2], cursor: 'c', metadata: 'first' })
    expect(fetch).toHaveBeenNthCalledWith(1, { cursor: 'start', limit: 3 })
    expect(fetch).toHaveBeenNthCalledWith(2, { cursor: 'a', limit: 3 })
    expect(fetch).toHaveBeenNthCalledWith(3, { cursor: 'b', limit: 3 })
  })

  it('stops refilling once half of the page is filled', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], cursor: 'a' })
      .mockResolvedValueOnce({ items: [2], cursor: 'b' })
      .mockResolvedValueOnce({ items: [3], cursor: 'c' })

    await expect(
      fillPage({ cursor: undefined, limit: 4, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [1, 2], cursor: 'b' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('refills a single item page, since half of it rounds up', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [], cursor: 'a' })
      .mockResolvedValueOnce({ items: [1], cursor: 'b' })

    await expect(
      fillPage({ cursor: undefined, limit: 1, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [1], cursor: 'b' })
    expect(fetch).toHaveBeenCalledTimes(2)
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

  it('keeps the start cursor of the first page across refills', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [], cursor: 'a', startCursor: 'newest' })
      .mockResolvedValueOnce({ items: [1, 2], cursor: 'b', startCursor: 'old' })

    await expect(
      fillPage({ cursor: undefined, limit: 2, fetch, items: (r) => r.items }),
    ).resolves.toEqual({ items: [1, 2], cursor: 'b', startCursor: 'newest' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('serves a short page rather than refilling past the terminal cursor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], cursor: 'since', startCursor: 'n' })

    await expect(
      fillPage({
        cursor: undefined,
        limit: 4,
        terminalCursor: 'since',
        fetch,
        items: (r) => r.items,
      }),
    ).resolves.toEqual({ items: [1], cursor: 'since', startCursor: 'n' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('preserves a terminal cursor reached while refilling', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [], cursor: 'a' })
      .mockResolvedValueOnce({ items: [], cursor: 'since' })

    await expect(
      fillPage({
        cursor: undefined,
        limit: 2,
        terminalCursor: 'since',
        fetch,
        items: (r) => r.items,
      }),
    ).resolves.toEqual({ items: [], cursor: 'since' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('refills normally when no terminal cursor is reached', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [], cursor: 'a' })
      .mockResolvedValueOnce({ items: [1], cursor: 'b' })

    await expect(
      fillPage({
        cursor: undefined,
        limit: 1,
        terminalCursor: 'since',
        fetch,
        items: (r) => r.items,
      }),
    ).resolves.toEqual({ items: [1], cursor: 'b' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
