import { describe, expect, it, vi } from 'vitest'
import { withCleanupOnError } from './cleanup-on-error.js'

describe(withCleanupOnError, () => {
  it('returns the result without running any cleanup on success', async () => {
    const cleanup = vi.fn()

    const result = await withCleanupOnError(async (onError) => {
      onError(cleanup)
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('runs every registered cleanup, most recent first, then rethrows', async () => {
    const calls: string[] = []
    const error = new Error('third step failed')

    const promise = withCleanupOnError(async (onError) => {
      onError(() => calls.push('first'))
      onError(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        calls.push('second')
      })
      throw error
    })

    await expect(promise).rejects.toBe(error)
    expect(calls).toEqual(['second', 'first'])
  })

  it('runs no cleanup registered after the failure point', async () => {
    const before = vi.fn()
    const after = vi.fn()

    await expect(
      withCleanupOnError(async (onError) => {
        onError(before)
        await Promise.reject(new Error('start failed'))
        onError(after)
      }),
    ).rejects.toThrow('start failed')

    expect(before).toHaveBeenCalledOnce()
    expect(after).not.toHaveBeenCalled()
  })

  it('keeps running cleanups when one fails, and rethrows the original error', async () => {
    const error = new Error('start failed')
    const first = vi.fn()
    const third = vi.fn(async () => {})

    const promise = withCleanupOnError(async (onError) => {
      onError(first)
      onError(() => {
        throw new Error('sync cleanup failed')
      })
      onError(async () => {
        throw new Error('async cleanup failed')
      })
      onError(third)
      throw error
    })

    await expect(promise).rejects.toBe(error)
    expect(third).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
  })
})
