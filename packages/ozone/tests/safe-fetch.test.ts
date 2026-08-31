import { jest } from '@jest/globals'
import { SafeDidResolver, createSafeFetch } from '../src/safe-fetch.js'

describe('safe fetch', () => {
  it.each([
    'http://example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://169.254.169.254',
  ])('rejects unsafe target %s', async (target) => {
    const safeFetch = createSafeFetch()
    await expect(safeFetch(target)).rejects.toThrow()
  })

  it('disables redirects', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    const safeFetch = createSafeFetch()

    await safeFetch('https://api.bsky.app')

    const request = fetch.mock.calls[0][0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).redirect).toBe('error')
    fetch.mockRestore()
  })

  it('allows nonstandard HTTPS ports', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    const safeFetch = createSafeFetch()

    await safeFetch('https://api.bsky.app:8443')

    expect(fetch).toHaveBeenCalled()
    fetch.mockRestore()
  })

  it('protects did:web resolution', async () => {
    const resolver = new SafeDidResolver({ timeout: 100 })
    await expect(resolver.resolve('did:web:127.0.0.1')).rejects.toThrow()
  })
})
