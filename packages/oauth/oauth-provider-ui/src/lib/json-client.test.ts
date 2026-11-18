import { describe, expect, it, vi } from 'vitest'
import { apiErrorParser } from './api-error-parser.ts'
import { RateLimitExceededError, parseApiErrorPayload } from './api.ts'
import { type Json, JsonClient, JsonErrorResponse } from './json-client.ts'

type Endpoints = {
  '/test': { method: 'POST'; input: Json; output: Json }
}

class TestClient extends JsonClient<Endpoints> {
  call() {
    return this.fetch(
      'POST',
      '/test',
      {},
      {
        // Same mapping as the Api
        parseError: (response, payload) =>
          parseApiErrorPayload(response.status, response.headers, payload),
      },
    )
  }
}

async function callWith(response: Response): Promise<unknown> {
  using _fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
  using _warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  // @NOTE awaited for the spies to outlive the request
  return await new TestClient('https://pds.test/api').call().then(
    () => expect.unreachable('the request should fail'),
    (err: unknown) => err,
  )
}

describe(JsonClient, () => {
  it('reports a non-JSON 429 (e.g. from a rate limiting edge) as a rate limit error', async () => {
    const err = await callWith(
      new Response('<html>Too Many Requests</html>', {
        status: 429,
        headers: { 'content-type': 'text/html', 'retry-after': '30' },
      }),
    )

    expect(err).toBeInstanceOf(RateLimitExceededError)
    expect(err).toMatchObject({ status: 429, payload: null, retryAfter: 30 })
    expect(apiErrorParser(err)).toMatchObject({
      name: 'RateLimitExceededError',
      code: undefined,
      description: (err as RateLimitExceededError).msg,
    })
  })

  it('reports an empty 429 without Retry-After as a rate limit error', async () => {
    // As answered by Envoy Gateway's rate limits
    const err = await callWith(
      new Response(null, {
        status: 429,
        headers: { 'x-envoy-ratelimited': 'true' },
      }),
    )

    expect(err).toBeInstanceOf(RateLimitExceededError)
    expect(err).toMatchObject({ payload: null, retryAfter: undefined })
  })

  it("keeps the server's own rate limit details", async () => {
    const err = await callWith(
      Response.json(
        {
          error: 'rate_limit_exceeded',
          error_description: 'Too many requests, please try again later',
        },
        { status: 429, headers: { 'retry-after': '12' } },
      ),
    )

    expect(err).toBeInstanceOf(RateLimitExceededError)
    expect(err).toMatchObject({
      retryAfter: 12,
      message: 'Too many requests, please try again later',
    })
    expect(apiErrorParser(err)).toMatchObject({ code: 'rate_limit_exceeded' })
  })

  it('reports other non-JSON error responses by status', async () => {
    const err = await callWith(
      new Response('<html>Service Unavailable</html>', {
        status: 503,
        headers: { 'content-type': 'text/html' },
      }),
    )

    expect(err).toBeInstanceOf(JsonErrorResponse)
    expect(err).not.toBeInstanceOf(RateLimitExceededError)
    expect(err).toMatchObject({ status: 503, payload: null })
    expect(apiErrorParser(err)).toMatchObject({
      description: (err as JsonErrorResponse).msg,
    })
  })

  it('rejects non-JSON success responses', async () => {
    const err = await callWith(
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )

    expect(err).not.toBeInstanceOf(JsonErrorResponse)
    expect(err).toMatchObject({ message: 'Invalid content type "text/html"' })
  })
})
