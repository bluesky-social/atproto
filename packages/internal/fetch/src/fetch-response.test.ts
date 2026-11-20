import { afterEach, describe, expect, it, vi } from 'vitest'
import { FetchResponseError, peekJson } from './fetch-response.js'

const encoder = new TextEncoder()

function streamedJsonResponse(chunks: string[] | Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === 'string' ? encoder.encode(chunk) : chunk,
        )
      }
      controller.close()
    },
  })
  // No Content-Length, so the size limit can only be enforced while reading
  return new Response(body, {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe(peekJson, () => {
  it('parses a streamed JSON body and leaves the response readable', async () => {
    const response = streamedJsonResponse(['{"error":', '"use_dpop_nonce"}'])

    await expect(peekJson(response, 1024)).resolves.toEqual({
      error: 'use_dpop_nonce',
    })
    expect(response.bodyUsed).toBe(false)
    await expect(response.json()).resolves.toEqual({
      error: 'use_dpop_nonce',
    })
  })

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = encoder.encode('{"message":"héllo 🦋"}')
    const split = bytes.indexOf(0xa9) // second byte of "é"
    const response = streamedJsonResponse([
      bytes.subarray(0, split),
      bytes.subarray(split),
    ])

    await expect(peekJson(response, 1024)).resolves.toEqual({
      message: 'héllo 🦋',
    })
  })

  it('rejects a streamed body larger than maxSize', async () => {
    const response = streamedJsonResponse(['{"error":', '"use_dpop_nonce"}'])

    const result = peekJson(response, 10)
    await expect(result).rejects.toBeInstanceOf(FetchResponseError)
    await expect(result).rejects.toMatchObject({
      statusCode: 502,
      message: 'Response too large',
    })
  })

  it('rejects a Content-Length larger than maxSize', async () => {
    const response = new Response('{}', {
      headers: { 'Content-Type': 'application/json', 'Content-Length': '11' },
    })

    await expect(peekJson(response, 10)).rejects.toBeInstanceOf(
      FetchResponseError,
    )
  })

  it('ignores non-JSON responses', async () => {
    const response = new Response('{}', {
      headers: { 'Content-Type': 'text/plain' },
    })

    await expect(peekJson(response, 1024)).resolves.toBeUndefined()
  })

  describe('with a global Response that cannot wrap a stream', () => {
    // On react-native, the global Response is whatwg-fetch's polyfill even
    // when fetch() comes from Expo and returns responses with a stream body.
    // That polyfill assigns `type`, `statusText` and `url` as own properties
    // (which throws when a subclass defines getters for them) and stringifies
    // ReadableStream bodies.
    function PolyfillResponse(this: any, _body: unknown, init?: ResponseInit) {
      this.type = 'default'
      this.status = init?.status ?? 200
      this.statusText = init?.statusText ?? ''
      this.url = ''
    }

    afterEach(() => {
      vi.unstubAllGlobals()
      vi.resetModules()
    })

    it('parses a streamed JSON body', async () => {
      const response = streamedJsonResponse(['{"error":"use_dpop_nonce"}'])

      vi.stubGlobal('Response', PolyfillResponse)
      vi.resetModules()
      const mod = await import('./fetch-response.js')

      await expect(mod.peekJson(response, 1024)).resolves.toEqual({
        error: 'use_dpop_nonce',
      })
    })
  })
})
