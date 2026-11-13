import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { isHttpError } from 'http-errors'
import { describe, expect, it, vi } from 'vitest'
import { cidForRawHash } from '@atproto/lex-data'
import type { AppContext } from '../context.js'
import { createMiddleware } from './blob-resolver.js'

const DID = 'did:plc:abcdefghijklmnopqrstuvwx'
const CID = cidForRawHash(
  createHash('sha256').update('synthetic blob').digest(),
)
const TOKEN = 'synthetic-policy-token'
const AUTHORIZATION = `Bearer ${TOKEN}`
const PDS_ENDPOINT = 'https://pds.example'

type FixtureOptions = {
  token?: string
  takenDown?: boolean
  identity?: { services: Uint8Array }
  pdsEndpoint?: string
}

function createFixture(options: FixtureOptions = {}) {
  const pdsEndpoint = options.pdsEndpoint ?? PDS_ENDPOINT
  const identity =
    options.identity === undefined
      ? {
          services: new TextEncoder().encode(
            JSON.stringify({
              atproto_pds: {
                Type: 'AtprotoPersonalDataServer',
                URL: pdsEndpoint,
              },
            }),
          ),
        }
      : options.identity
  const getIdentityByDid = vi.fn(async () => identity)
  const getBlobTakedown = vi.fn(async () => ({
    takenDown: options.takenDown ?? false,
  }))
  const stream = vi.fn()
  const cfg = {
    blobSourceHandoffToken: options.token,
    proxyPreferCompressed: false,
  }
  const ctx = {
    cfg,
    dataplane: { getIdentityByDid, getBlobTakedown },
    blobDispatcher: { stream },
  } as unknown as AppContext
  return { ctx, getIdentityByDid, getBlobTakedown, stream }
}

async function request(ctx: AppContext, path: string, authorization?: string) {
  const middleware = createMiddleware(ctx)
  const server = createServer((req, res) => {
    void (async () => {
      await middleware(req, res, (err) => {
        if (res.headersSent || res.destroyed) return
        res.statusCode = isHttpError(err) ? err.statusCode : err ? 500 : 404
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            message: isHttpError(err) ? err.message : 'Not found',
          }),
        )
      })
    })().catch(() => {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message: 'Internal error' }))
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}${path}`,
      authorization === undefined ? undefined : { headers: { authorization } },
    )
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

describe('blob source policy', () => {
  it('is inert without a configured token', async () => {
    const fixture = createFixture()
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}`,
      AUTHORIZATION,
    )

    expect(response.status).toBe(404)
    expect(fixture.getIdentityByDid).not.toHaveBeenCalled()
    expect(fixture.getBlobTakedown).not.toHaveBeenCalled()
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    'Bearer wrong-token',
    `Basic ${TOKEN}`,
    `bearer ${TOKEN}`,
    `Bearer  ${TOKEN}`,
  ])(
    'rejects invalid authorization %s before doing any lookups',
    async (auth) => {
      const fixture = createFixture({ token: TOKEN })
      const response = await request(
        fixture.ctx,
        `/blob-source/not-a-did/not-a-cid`,
        auth,
      )

      expect(response.status).toBe(401)
      expect(response.text).not.toContain(TOKEN)
      expect(fixture.getIdentityByDid).not.toHaveBeenCalled()
      expect(fixture.getBlobTakedown).not.toHaveBeenCalled()
      expect(fixture.stream).not.toHaveBeenCalled()
    },
  )

  it('authenticates malformed paths under an enabled source prefix', async () => {
    const fixture = createFixture({ token: TOKEN })
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}/extra`,
    )

    expect(response.status).toBe(401)
    expect(fixture.getIdentityByDid).not.toHaveBeenCalled()
    expect(fixture.getBlobTakedown).not.toHaveBeenCalled()
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it('ignores query parameters when resolving the requested blob', async () => {
    const fixture = createFixture({ token: TOKEN })
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}?cacheBuster=1&ignored=/extra`,
      AUTHORIZATION,
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(response.text)).toEqual({
      takenDown: false,
      origin: PDS_ENDPOINT,
    })
    expect(fixture.getBlobTakedown).toHaveBeenCalledWith({
      did: DID,
      cid: CID.toString(),
    })
  })

  it('returns a non-taken-down verdict and normalized origin without fetching bytes', async () => {
    const fixture = createFixture({
      token: TOKEN,
      pdsEndpoint:
        'https://user:password@pds.example:443/private/path?secret=query#fragment',
    })
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}`,
      AUTHORIZATION,
    )

    expect(response.status).toBe(200)
    expect(JSON.parse(response.text)).toEqual({
      takenDown: false,
      origin: PDS_ENDPOINT,
    })
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

  it('agrees with the blob route on takedowns without contacting a PDS', async () => {
    const fixture = createFixture({ token: TOKEN, takenDown: true })
    const source = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}`,
      AUTHORIZATION,
    )
    const blob = await request(fixture.ctx, `/blob/${DID}/${CID}`)

    expect(source.status).toBe(200)
    expect(JSON.parse(source.text)).toEqual({ takenDown: true })
    expect(blob.status).toBe(404)
    expect(JSON.parse(blob.text)).toEqual({ message: 'Blob not found' })
    expect(fixture.getBlobTakedown).toHaveBeenCalledTimes(2)
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it.each([
    [`/blob-source/did::/${CID}`, 'Invalid did'],
    [`/blob-source/${DID}/not-a-cid`, 'Invalid cid'],
  ])('rejects malformed input before any lookup', async (path, message) => {
    const fixture = createFixture({ token: TOKEN })
    const response = await request(fixture.ctx, path, AUTHORIZATION)

    expect(response.status).toBe(400)
    expect(JSON.parse(response.text)).toEqual({ message })
    expect(fixture.getIdentityByDid).not.toHaveBeenCalled()
    expect(fixture.getBlobTakedown).not.toHaveBeenCalled()
    expect(fixture.stream).not.toHaveBeenCalled()
  })

  it('returns 404 when no PDS origin can be resolved', async () => {
    const fixture = createFixture({
      token: TOKEN,
      identity: { services: new Uint8Array() },
    })
    const response = await request(
      fixture.ctx,
      `/blob-source/${DID}/${CID}`,
      AUTHORIZATION,
    )

    expect(response.status).toBe(404)
    expect(JSON.parse(response.text)).toEqual({ message: 'Origin not found' })
    expect(fixture.stream).not.toHaveBeenCalled()
  })
})
