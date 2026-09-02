import { jest } from '@jest/globals'
import { AtpAgent } from '@atproto/api'
import type { IdResolver } from '@atproto/identity'
import {
  createPdsAgentWithHeaders,
  getPdsAgentForRepo,
} from '../src/mod-service/util.js'

// Captures the headers an agent actually puts on the wire, rather than its
// internal state. The agent is built by a factory rather than passed in
// because XrpcClient resolves `fetch = globalThis.fetch` when it is
// constructed (see xrpc/src/fetch-handler.ts), so an agent created before the
// spy is installed keeps a reference to the real fetch. The response is
// discarded: only the outbound request matters.
const headersSentBy = async (makeAgent: () => AtpAgent): Promise<Headers> => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('{}', { status: 200 }))
  try {
    const agent = makeAgent()
    await agent.com.atproto.server.describeServer().catch(() => {})
    const request = fetch.mock.calls[0]?.[0] as Request
    expect(request).toBeInstanceOf(Request)
    return request.headers
  } finally {
    fetch.mockRestore()
  }
}

const SERVICE = 'https://pds.example.com'

describe('createPdsAgentWithHeaders', () => {
  it('sends each configured header', async () => {
    const headers = await headersSentBy(() =>
      createPdsAgentWithHeaders(SERVICE, {
        'x-first': 'one',
        'x-second': 'two',
      }),
    )

    expect(headers.get('x-first')).toBe('one')
    expect(headers.get('x-second')).toBe('two')
  })

  it('sends no extra headers when none are configured', async () => {
    const configured = await headersSentBy(() =>
      createPdsAgentWithHeaders(SERVICE),
    )
    const bare = await headersSentBy(() => new AtpAgent({ service: SERVICE }))

    expect([...configured.keys()].sort()).toEqual([...bare.keys()].sort())
  })

  it('treats an empty header map as none', () => {
    const agent = createPdsAgentWithHeaders(SERVICE, {})

    expect(agent.headers.size).toBe(0)
  })

  // Configured headers are instance defaults, so a per-request header of the
  // same name must win. Service auth passes `authorization` per call; a
  // configured header must never displace it.
  it('does not override a per-request header of the same name', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))
    try {
      const agent = createPdsAgentWithHeaders(SERVICE, {
        authorization: 'Bearer configured',
      })
      await agent.com.atproto.server
        .describeServer(undefined, {
          headers: { authorization: 'Bearer per-request' },
        })
        .catch(() => {})
      const request = fetch.mock.calls[0]?.[0] as Request
      expect(request.headers.get('authorization')).toBe('Bearer per-request')
    } finally {
      fetch.mockRestore()
    }
  })
})

describe('getPdsAgentForRepo', () => {
  // The counterpart to createPdsAgentWithHeaders: its target comes from the
  // repo's DID document and may be any third-party host, so configured
  // headers -- which can be credentials scoped to our own PDS -- must never
  // ride along. Guards against the two factories being swapped.
  it('produces an agent carrying no configured headers', async () => {
    const idResolver = {
      did: {
        resolveAtprotoData: async () => ({
          pds: 'https://third-party.example',
        }),
      },
    } as unknown as IdResolver

    const { agent } = await getPdsAgentForRepo(idResolver, 'did:plc:example')

    expect(agent).not.toBeNull()
    expect(agent?.headers.size).toBe(0)
  })
})
