import { describe, expect, it, vi } from 'vitest'
import { timedFetch } from './fetch-wrap.js'

/** Never settles unless its signal aborts, then rejects with the reason. */
function hangingFetch() {
  return vi.fn(
    (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener('abort', () => reject(signal.reason))
      }),
  )
}

describe(timedFetch, () => {
  it('rejects with the reason of the request signal', async () => {
    const fetch = timedFetch(60e3, hangingFetch())
    const controller = new AbortController()
    const reason = new Error('cancelled')

    const promise = fetch('https://example.com', { signal: controller.signal })
    controller.abort(reason)

    await expect(promise).rejects.toBe(reason)
  })

  it('rejects with a TimeoutError when its own timeout elapses', async () => {
    const fetch = timedFetch(1, hangingFetch())

    await expect(fetch('https://example.com')).rejects.toMatchObject({
      name: 'TimeoutError',
    })
  })

  it('does not send a request whose signal is already aborted', async () => {
    const inner = vi.fn(async () => new Response('ok'))
    const fetch = timedFetch(60e3, inner)
    const reason = new Error('cancelled')

    await expect(
      fetch('https://example.com', { signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason)
    expect(inner).not.toHaveBeenCalled()
  })
})
