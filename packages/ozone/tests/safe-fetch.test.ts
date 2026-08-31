import { jest } from '@jest/globals'
import { createSafeFetch } from '../src/safe-fetch.js'

describe('safe fetch', () => {
  it.each([
    'http://example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://169.254.169.254',
  ])('rejects unsafe target %s', async (target) => {
    const safeFetch = createSafeFetch(1024)
    await expect(safeFetch(target)).rejects.toThrow()
  })

  it('disables redirects', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    const safeFetch = createSafeFetch(1024)

    await safeFetch('https://api.bsky.app')

    const request = fetch.mock.calls[0][0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).redirect).toBe('error')
    fetch.mockRestore()
  })
})
