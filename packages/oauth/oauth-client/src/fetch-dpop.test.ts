import { describe, expect, it, vi } from 'vitest'
import type { Key } from '@atproto/jwk'
import { SimpleStoreMemory } from '@atproto-labs/simple-store-memory'
import { dpopFetchWrapper } from './fetch-dpop.js'

const PAR_URL = 'https://as.example.com/oauth/par'

// Only the members used by dpopFetchWrapper. The "JWT" is the JSON payload, so
// the fake server can read the nonce back from the DPoP header.
const key = {
  algorithms: ['ES256'],
  bareJwk: { kty: 'EC' },
  createJwt: async (_header: unknown, payload: unknown) =>
    JSON.stringify(payload),
} as unknown as Key

function proofNonce(request: Request): string | undefined {
  return JSON.parse(request.headers.get('DPoP')!).nonce
}

// Like Expo's fetch: a stream body and no Content-Length
function streamedJsonResponse(
  status: number,
  json: unknown,
  headers: Record<string, string> = {},
): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(json)))
      controller.close()
    },
  })
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeDpopFetch(fetch: (request: Request) => Promise<Response>) {
  const fetchMock = vi.fn(fetch)
  const dpopFetch = dpopFetchWrapper<void>({
    key,
    nonces: new SimpleStoreMemory({ max: 10 }),
    isAuthServer: true,
    fetch: (input, init) => fetchMock(new Request(input, init)),
  })
  const par = () =>
    dpopFetch(PAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'client_id=foo',
    })
  return { fetchMock, par }
}

describe(dpopFetchWrapper, () => {
  it('retries an authorization server request with the nonce from a use_dpop_nonce error', async () => {
    const { fetchMock, par } = makeDpopFetch(async (request) => {
      if (proofNonce(request) !== 'nonce-1') {
        return streamedJsonResponse(
          400,
          { error: 'use_dpop_nonce' },
          { 'DPoP-Nonce': 'nonce-1' },
        )
      }
      return streamedJsonResponse(201, { request_uri: 'urn:foo' })
    })

    const response = await par()

    expect(response.status).toBe(201)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(proofNonce(fetchMock.mock.calls[0][0])).toBeUndefined()
    expect(proofNonce(fetchMock.mock.calls[1][0])).toBe('nonce-1')
    await expect(fetchMock.mock.calls[1][0].text()).resolves.toBe(
      'client_id=foo',
    )
  })

  it('does not retry other errors', async () => {
    const { fetchMock, par } = makeDpopFetch(async () =>
      streamedJsonResponse(
        400,
        { error: 'invalid_request' },
        { 'DPoP-Nonce': 'nonce-1' },
      ),
    )

    const response = await par()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry responses too large to be a use_dpop_nonce error', async () => {
    const { fetchMock, par } = makeDpopFetch(async () =>
      streamedJsonResponse(
        400,
        { error: 'use_dpop_nonce', padding: 'x'.repeat(20 * 1024) },
        { 'DPoP-Nonce': 'nonce-1' },
      ),
    )

    const response = await par()

    expect(response.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces unexpected errors instead of skipping the retry', async () => {
    const { par } = makeDpopFetch(async () => {
      const response = streamedJsonResponse(
        400,
        { error: 'use_dpop_nonce' },
        { 'DPoP-Nonce': 'nonce-1' },
      )
      // A response whose body can no longer be peeked at
      await response.text()
      return response
    })

    await expect(par()).rejects.toBeInstanceOf(TypeError)
  })
})
