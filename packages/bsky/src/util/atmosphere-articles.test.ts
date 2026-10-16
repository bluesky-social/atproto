import { describe, expect, it, test, vi } from 'vitest'
import { Client } from '@atproto/lex'
import {
  UpstreamFailureError,
  UpstreamTimeoutError,
} from '@atproto/xrpc-server'
import { app } from '../lexicons/index.js'
import { fetchAtmosphereArticleRecommendations } from './atmosphere-articles.js'

const lxm = app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$lxm
const documentUri = 'at://did:plc:author/site.standard.document/story'
const viewer = 'did:plc:viewer'

type Fetch = (request: Request) => Response | Promise<Response>

function setup(fetchImpl: Fetch) {
  const fetchMock = vi.fn<typeof globalThis.fetch>(async (input, init) =>
    fetchImpl(new Request(input, init)),
  )
  // Mirrors the production Iris client, whose bearer lives in the agent and
  // whose own response validation is off.
  const client = new Client(
    {
      service: 'https://iris.test/base-ignored',
      headers: { authorization: 'Bearer iris-key' },
      fetch: fetchMock,
    },
    {
      headers: { 'x-client-default': 'default' },
      strictResponseProcessing: false,
      validateResponse: false,
    },
  )
  return { client, fetchMock }
}

const respond = (body: unknown) => () => Response.json(body)
const fetchWith = (
  client: Client,
  params: app.bsky.unspecced.getAtmosphereExploreArticleRecommendations.$Params = {
    limit: 25,
  },
  signal: AbortSignal = new AbortController().signal,
  headers: Record<string, string> = {},
) => fetchAtmosphereArticleRecommendations(client, params, { headers, signal })

describe(fetchAtmosphereArticleRecommendations, () => {
  it('requests the Iris endpoint and returns URIs with the rec ID', async () => {
    const { client, fetchMock } = setup(
      respond({ articles: [{ uri: documentUri }], recIdStr: '42' }),
    )
    await expect(fetchWith(client, { viewer, limit: 25 })).resolves.toEqual({
      articles: [{ uri: documentUri }],
      recIdStr: '42',
    })
    const request = fetchMock.mock.calls[0]
    const url = new URL(
      request[0] instanceof Request ? request[0].url : String(request[0]),
    )
    expect(url.origin + url.pathname).toBe(`https://iris.test/xrpc/${lxm}`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      viewer,
      limit: '25',
    })
  })

  it('omits the viewer for anonymous requests', async () => {
    const { client, fetchMock } = setup(
      respond({ articles: [], recIdStr: '1' }),
    )
    await fetchWith(client, { viewer: undefined, limit: 25 })
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.has('viewer')).toBe(false)
  })

  it('forwards the requested limit', async () => {
    const { client, fetchMock } = setup(
      respond({ articles: [], recIdStr: '1' }),
    )
    await fetchWith(client, { limit: 7 })
    expect(
      new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('limit'),
    ).toBe('7')
  })

  it('returns an empty list with its rec ID', async () => {
    const { client } = setup(respond({ articles: [], recIdStr: '99' }))
    await expect(fetchWith(client)).resolves.toEqual({
      articles: [],
      recIdStr: '99',
    })
  })

  it('preserves configured and per-request headers and refuses redirects', async () => {
    const { client, fetchMock } = setup(
      respond({ articles: [], recIdStr: '1' }),
    )
    await fetchWith(client, undefined, undefined, {
      'accept-language': 'en,es',
      'x-atproto-bsky-topics': 'a,b',
    })
    const init = fetchMock.mock.calls[0][1]
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer iris-key')
    expect(headers.get('x-client-default')).toBe('default')
    expect(headers.get('accept-language')).toBe('en,es')
    expect(headers.get('x-atproto-bsky-topics')).toBe('a,b')
    expect(init?.redirect).toBe('error')
  })

  it('does not alter the shared client', async () => {
    const { client } = setup(
      respond({ articles: [{ uri: 'bad' }], recIdStr: '1' }),
    )
    await expect(fetchWith(client)).rejects.toBeInstanceOf(UpstreamFailureError)
    expect(client.xrpcDefaults.validateResponse).toBe(false)
  })

  test.each([
    ['missing rec ID', { articles: [] }],
    ['non-string rec ID', { articles: [], recIdStr: 1 }],
    ['missing articles', { recIdStr: '1' }],
    ['non-AT-URI', { articles: [{ uri: 'not-a-uri' }], recIdStr: '1' }],
    ['missing uri', { articles: [{}], recIdStr: '1' }],
    [
      'too many articles',
      {
        articles: Array.from({ length: 101 }, () => ({ uri: documentUri })),
        recIdStr: '1',
      },
    ],
    ['non-object body', []],
  ])(
    'rejects invalid payloads even with client validation off: %s',
    async (_, body) => {
      const { client } = setup(respond(body))
      await expect(fetchWith(client, { limit: 100 })).rejects.toBeInstanceOf(
        UpstreamFailureError,
      )
    },
  )

  it('rejects more articles than requested', async () => {
    const articles = Array.from({ length: 3 }, () => ({ uri: documentUri }))
    const { client } = setup(respond({ articles, recIdStr: '1' }))
    await expect(fetchWith(client, { limit: 2 })).rejects.toBeInstanceOf(
      UpstreamFailureError,
    )
    await expect(fetchWith(client, { limit: 3 })).resolves.toMatchObject({
      articles,
    })
  })

  it('caps decoded bytes even without Content-Length', async () => {
    const { client } = setup(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder()
              controller.enqueue(encoder.encode('{"articles":[],"recIdStr":"'))
              for (let i = 0; i < 9; i++) {
                controller.enqueue(encoder.encode('x'.repeat(64 * 1024)))
              }
              controller.enqueue(encoder.encode('"}'))
              controller.close()
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    )
    await expect(fetchWith(client)).rejects.toBeInstanceOf(UpstreamFailureError)
  })

  it('rejects an oversized Content-Length before reading', async () => {
    const { client } = setup(
      () =>
        new Response('{"articles":[],"recIdStr":"1"}', {
          headers: {
            'content-type': 'application/json',
            'content-length': String(1024 * 1024),
          },
        }),
    )
    await expect(fetchWith(client)).rejects.toBeInstanceOf(UpstreamFailureError)
  })

  test.each([
    ['HTTP 503', () => new Response('', { status: 503 })],
    [
      'HTTP 400',
      () => Response.json({ error: 'InvalidRequest' }, { status: 400 }),
    ],
    ['HTTP 401', () => new Response('', { status: 401 })],
    [
      'redirect',
      () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://elsewhere.test/' },
        }),
    ],
    [
      'network',
      () => {
        throw new TypeError('Network failure')
      },
    ],
    [
      'invalid JSON',
      () =>
        new Response('{', { headers: { 'content-type': 'application/json' } }),
    ],
  ])('maps upstream failures to 502: %s', async (_, handler) => {
    const { client } = setup(handler)
    await expect(fetchWith(client)).rejects.toBeInstanceOf(UpstreamFailureError)
  })

  describe('deadlines and cancellation', () => {
    const abortable = (signal: AbortSignal | null | undefined) =>
      new Promise<never>((_, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        })
      })

    it('applies a five second deadline to the request', async () => {
      const deadline = new AbortController()
      using timeout = vi
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValue(deadline.signal)
      const { client } = setup((request) => abortable(request.signal))
      const pending = fetchWith(client)
      deadline.abort(new DOMException('Timed out', 'TimeoutError'))
      await expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError)
      expect(timeout).toHaveBeenCalledWith(5000)
    })

    // Like undici, the body errors when the request signal aborts.
    function stallingBody() {
      let markStarted!: () => void
      const started = new Promise<void>((resolve) => (markStarted = resolve))
      const handler: Fetch = (request) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"articles":'))
              request.signal.addEventListener('abort', () =>
                controller.error(request.signal.reason),
              )
              markStarted()
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      return { handler, started }
    }

    it('applies the deadline while the body is being consumed', async () => {
      const deadline = new AbortController()
      using _timeout = vi
        .spyOn(AbortSignal, 'timeout')
        .mockReturnValue(deadline.signal)
      const { handler, started } = stallingBody()
      const { client } = setup(handler)
      const pending = fetchWith(client)
      await started
      deadline.abort(new DOMException('Timed out', 'TimeoutError'))
      await expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError)
    })

    it('maps caller cancellation, including during the body, to 504', async () => {
      const caller = new AbortController()
      const { handler, started } = stallingBody()
      const { client } = setup(handler)
      const pending = fetchWith(client, undefined, caller.signal)
      await started
      caller.abort(new Error('client went away'))
      await expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError)
    })

    it('maps an already-aborted caller signal to 504', async () => {
      const { client, fetchMock } = setup(
        respond({ articles: [], recIdStr: '1' }),
      )
      await expect(
        fetchWith(client, undefined, AbortSignal.abort(new Error('gone'))),
      ).rejects.toBeInstanceOf(UpstreamTimeoutError)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('maps a directly thrown TimeoutError to 504', async () => {
      const { client } = setup(() => {
        throw new DOMException('Timed out', 'TimeoutError')
      })
      await expect(fetchWith(client)).rejects.toBeInstanceOf(
        UpstreamTimeoutError,
      )
    })
  })

  it('does not retry failures', async () => {
    const { client, fetchMock } = setup(() => new Response('', { status: 503 }))
    await expect(fetchWith(client)).rejects.toBeInstanceOf(UpstreamFailureError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
