import { describe, expect, it, vi } from 'vitest'
import { Client, type ClientOptions } from './client.js'
import { com } from './lexicons/index.js'

const SERVICE = 'https://pds.example.com'

const params = {
  repo: 'did:plc:alice',
  collection: 'com.example.record',
  rkey: 'self',
} as const

async function headersSent(
  options: ClientOptions | undefined,
  headers?: HeadersInit | (() => Promise<HeadersInit>),
): Promise<Headers> {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({
      uri: 'at://did:plc:alice/com.example.record/self',
      value: {},
    }),
  )
  const client = new Client({ service: SERVICE, fetch }, options)
  await client.xrpc(com.atproto.repo.getRecord, { params, headers })
  expect(fetch).toHaveBeenCalledOnce()
  const [input, init] = fetch.mock.calls[0]
  return new Headers(input instanceof Request ? input.headers : init?.headers)
}

describe('Client headers', () => {
  it('sends each configured header', async () => {
    const headers = await headersSent({
      headers: { 'x-first': 'one', 'x-second': 'two' },
    })
    expect(headers.get('x-first')).toBe('one')
    expect(headers.get('x-second')).toBe('two')
  })

  it('sends no extra headers when none are configured', async () => {
    const configured = await headersSent({ headers: undefined })
    const bare = await headersSent(undefined)
    expect([...configured.keys()].sort()).toEqual([...bare.keys()].sort())
  })

  // Service auth passes `authorization` per call: a configured header must
  // never displace it.
  it('lets a per-request header override a configured one', async () => {
    const headers = await headersSent(
      { headers: { authorization: 'Bearer configured', 'x-kept': 'yes' } },
      { authorization: 'Bearer per-request' },
    )
    expect(headers.get('authorization')).toBe('Bearer per-request')
    expect(headers.get('x-kept')).toBe('yes')
  })

  it('merges configured headers under per-request headers from a function', async () => {
    const headers = await headersSent(
      { headers: { authorization: 'Bearer configured', 'x-kept': 'yes' } },
      async () => ({ authorization: 'Bearer per-request' }),
    )
    expect(headers.get('authorization')).toBe('Bearer per-request')
    expect(headers.get('x-kept')).toBe('yes')
  })
})
