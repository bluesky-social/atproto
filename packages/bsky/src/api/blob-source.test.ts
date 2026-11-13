import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { describe, expect, it, vi } from 'vitest'
import { cidForRawHash } from '@atproto/lex-data'
import type { AppContext } from '../context.js'
import { handler as errorHandler } from '../error.js'
import { createMiddleware } from './blob-resolver.js'
import { createRouter } from './blob-source.js'

const DID = 'did:plc:abcdefghijklmnopqrstuvwx'
const CID = cidForRawHash(createHash('sha256').update('blob').digest())
const PDS_ENDPOINT = 'https://pds.example'

type FixtureOptions = {
  takenDown?: boolean
  identity?: { services: Uint8Array }
  pdsEndpoint?: string
}

function createFixture(options: FixtureOptions = {}) {
  const identity = options.identity ?? {
    services: new TextEncoder().encode(
      JSON.stringify({
        atproto_pds: {
          Type: 'AtprotoPersonalDataServer',
          URL: options.pdsEndpoint ?? PDS_ENDPOINT,
        },
      }),
    ),
  }
  const getIdentityByDid = vi.fn(async () => identity)
  const getBlobTakedown = vi.fn(async () => ({
    takenDown: options.takenDown ?? false,
  }))
  const stream = vi.fn()
  const ctx = {
    cfg: { proxyPreferCompressed: false },
    dataplane: { getIdentityByDid, getBlobTakedown },
    blobDispatcher: { stream },
  } as unknown as AppContext
  return { ctx, getIdentityByDid, getBlobTakedown, stream }
}

async function request(ctx: AppContext, path: string, method = 'GET') {
  const app = express()
  app.use(createRouter(ctx))
  app.use(createMiddleware(ctx))
  app.use(errorHandler)
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
    })
    return {
      status: response.status,
      headers: response.headers,
      text: await response.text(),
    }
  } finally {
    server.closeAllConnections()
    server.close()
    await once(server, 'close')
  }
}

describe('blob source', () => {
  it('returns the origin without fetching the blob', async () => {
    const fixture = createFixture({
      pdsEndpoint:
        'https://user:password@pds.example:443/private/path?secret=query#fragment',
    })
    const response = await request(fixture.ctx, `/blob-source/${DID}/${CID}`)

    expect(response.status).toBe(200)
    expect(JSON.parse(response.text)).toEqual({ origin: PDS_ENDPOINT })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.text).not.toContain('password')
    expect(response.text).not.toContain('secret')
    expect(fixture.getIdentityByDid).toHaveBeenCalledWith({ did: DID })
    expect(fixture.getBlobTakedown).toHaveBeenCalledWith({
      did: DID,
      cid: CID.toString(),
    })
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it('agrees with the blob route on takedowns without fetching the blob', async () => {
    const fixture = createFixture({ takenDown: true })
    const source = await request(fixture.ctx, `/blob-source/${DID}/${CID}`)
    const blob = await request(fixture.ctx, `/blob/${DID}/${CID}`)

    expect(source.status).toBe(404)
    expect(source.headers.get('cache-control')).toBe('no-store')
    expect(blob.status).toBe(404)
    expect(fixture.getBlobTakedown).toHaveBeenCalledTimes(2)
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it('ignores query parameters when resolving the blob', async () => {
    const fixture = createFixture()
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}?cacheBuster=1&ignored=/extra`,
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(response.text)).toEqual({ origin: PDS_ENDPOINT })
    expect(fixture.getBlobTakedown).toHaveBeenCalledWith({
      did: DID,
      cid: CID.toString(),
    })
  })

  it('returns the same headers for HEAD without a body', async () => {
    const fixture = createFixture()
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}`,
      'HEAD',
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.text).toBe('')
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it.each([
    [`/blob-source/did::/${CID}`, 'Invalid did'],
    [`/blob-source/${DID}/not-a-cid`, 'Invalid cid'],
  ])('rejects malformed input before lookup', async (path, message) => {
    const fixture = createFixture()
    const response = await request(fixture.ctx, path)

    expect(response.status).toBe(400)
    expect(JSON.parse(response.text).message).toBe(message)
    expect(fixture.getIdentityByDid).not.toHaveBeenCalled()
    expect(fixture.getBlobTakedown).not.toHaveBeenCalled()
  })

  it('returns 404 when no PDS origin can be resolved', async () => {
    const fixture = createFixture({ identity: { services: new Uint8Array() } })
    const response = await request(fixture.ctx, `/blob-source/${DID}/${CID}`)

    expect(response.status).toBe(404)
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it('returns 502 when the policy lookup fails', async () => {
    const fixture = createFixture()
    fixture.getBlobTakedown.mockRejectedValueOnce(new Error('unavailable'))
    const response = await request(fixture.ctx, `/blob-source/${DID}/${CID}`)

    expect(response.status).toBe(502)
    expect(fixture.stream).not.toHaveBeenCalled()
  })
})
