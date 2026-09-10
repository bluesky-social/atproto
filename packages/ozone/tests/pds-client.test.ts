import { jest } from '@jest/globals'
import type { IdResolver } from '@atproto/identity'
import { Client } from '@atproto/lex'
import { com } from '../src/lexicons/index.js'
import { getPdsClientForRepo } from '../src/mod-service/util.js'

// fetch may be invoked as fetch(Request) or fetch(url, init) depending on how
// the client builds the call; read the headers out of either shape.
const requestHeaders = (call: readonly unknown[] | undefined): Headers => {
  const [input, init] = call ?? []
  return new Headers(
    input instanceof Request
      ? input.headers
      : ((init as RequestInit | undefined)?.headers ?? []),
  )
}

// Captures the headers a client actually puts on the wire, rather than its
// internal state. The client is built by a factory rather than passed in
// because the fetch implementation is resolved when the client is
// constructed, so a client created before the spy is installed keeps a
// reference to the real fetch. The response is discarded: only the outbound
// request matters.
const headersSentBy = async (makeClient: () => Client): Promise<Headers> => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  try {
    const client = makeClient()
    await client.call(com.atproto.server.describeServer, {}).catch(() => {})
    expect(fetch).toHaveBeenCalled()
    return requestHeaders(fetch.mock.calls[0])
  } finally {
    fetch.mockRestore()
  }
}

const SERVICE = 'https://pds.example.com'

// OZONE_PDS_HEADERS is passed straight to the Client as instance-wide
// headers. These cover the behaviour ozone relies on, so a change in that
// contract surfaces here rather than in production.
describe('configured PDS client headers', () => {
  it('sends each configured header', async () => {
    const headers = await headersSentBy(
      () =>
        new Client(
          { service: SERVICE },
          { headers: { 'x-first': 'one', 'x-second': 'two' } },
        ),
    )

    expect(headers.get('x-first')).toBe('one')
    expect(headers.get('x-second')).toBe('two')
  })

  it('sends no extra headers when none are configured', async () => {
    const configured = await headersSentBy(
      () => new Client({ service: SERVICE }, { headers: undefined }),
    )
    const bare = await headersSentBy(() => new Client({ service: SERVICE }))

    expect([...configured.keys()].sort()).toEqual([...bare.keys()].sort())
  })

  // Configured headers are instance-wide defaults, so a per-request header of
  // the same name must win. Service auth passes `authorization` per call; a
  // configured header must never displace it.
  it('does not override a per-request header of the same name', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    try {
      const client = new Client(
        { service: SERVICE },
        { headers: { authorization: 'Bearer configured' } },
      )
      await client
        .call(
          com.atproto.server.describeServer,
          {},
          {
            headers: { authorization: 'Bearer per-request' },
          },
        )
        .catch(() => {})
      expect(fetch).toHaveBeenCalled()
      const headers = requestHeaders(fetch.mock.calls[0])
      expect(headers.get('authorization')).toBe('Bearer per-request')
    } finally {
      fetch.mockRestore()
    }
  })
})

describe('getPdsClientForRepo', () => {
  // The counterpart to the configured PDS client: its target comes from the
  // repo's DID document and may be any third-party host, so configured
  // headers -- which can be credentials scoped to our own PDS -- must never
  // ride along. Guards against the two client factories being conflated.
  it('produces a client carrying no configured headers', async () => {
    const idResolver = {
      did: {
        resolveAtprotoData: async () => ({
          pds: 'https://third-party.example',
        }),
      },
    } as unknown as IdResolver

    const { client } = await getPdsClientForRepo(idResolver, 'did:plc:example')

    expect(client).not.toBeNull()
    expect([...(client?.headers.keys() ?? [])]).toEqual([])
  })
})
