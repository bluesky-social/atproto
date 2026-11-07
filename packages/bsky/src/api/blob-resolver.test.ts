import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { isHttpError } from 'http-errors'
import { describe, expect, it } from 'vitest'
import { cidForRawHash } from '@atproto/lex-data'
import type { AppContext } from '../context.js'
import { createBlobDispatcher } from './blob-dispatcher.js'
import { createMiddleware } from './blob-resolver.js'

const DID = 'did:plc:abcdefghijklmnopqrstuvwx'
const payload = Buffer.from('synthetic verified blob, not a production image')
const cid = cidForRawHash(createHash('sha256').update(payload).digest())
const adminAuthorization = `Basic ${Buffer.from('admin:synthetic-only').toString('base64')}`

async function listen(server: Server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  return `http://${address.address}:${address.port}`
}

async function close(server: Server) {
  server.closeAllConnections()
  server.close()
  await once(server, 'close')
}

function context(
  pds: string,
  redirectAdmin = false,
  takenDown = false,
  redirectOrigin?: string,
) {
  const origin = new URL(pds)
  const cfg = {
    blobRedirectAdminPassword: redirectAdmin ? 'synthetic-only' : undefined,
    blobRedirectAdminOrigin: redirectAdmin
      ? (redirectOrigin ?? origin.origin)
      : undefined,
    blobRateLimitBypassKey: redirectAdmin ? 'synthetic-bypass' : undefined,
    blobRateLimitBypassHostname: redirectAdmin ? origin.hostname : undefined,
    proxyPreferCompressed: false,
    disableSsrfProtection: true,
    proxyAllowHTTP2: false,
    proxyBodyTimeout: 30e3,
    proxyHeadersTimeout: 30e3,
    proxyMaxResponseSize: 10 * 1024 * 1024,
    proxyMaxRetries: 0,
  }
  return {
    cfg,
    blobDispatcher: createBlobDispatcher(cfg as AppContext['cfg']),
    dataplane: {
      getIdentityByDid: async () => ({
        services: new TextEncoder().encode(
          JSON.stringify({
            atproto_pds: {
              Type: 'AtprotoPersonalDataServer',
              URL: pds,
            },
          }),
        ),
      }),
      getBlobTakedown: async () => ({ takenDown }),
    },
  } as unknown as AppContext
}

async function proxyRequest(ctx: AppContext, signal?: AbortSignal) {
  const middleware = createMiddleware(ctx)
  const appview = createServer(async (req, res) => {
    await middleware(req, res, (error) => {
      res.statusCode = isHttpError(error) ? error.statusCode : 500
      res.end(error instanceof Error ? error.message : 'fixture error')
    })
  })
  const origin = await listen(appview)
  try {
    const response = await fetch(`${origin}/blob/${DID}/${cid}`, { signal })
    const body = Buffer.from(await response.arrayBuffer())
    if (response.status >= 400) {
      throw new Error(`Proxy ${response.status}: ${body.toString('utf8')}`)
    }
    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; sandbox",
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('content-length')).toBeNull()
    return body
  } finally {
    await close(appview)
  }
}

describe('internal PDS blob redirects', () => {
  it('scopes the credential to the PDS and verifies redirected bytes', async () => {
    const pdsAuthorizations: Array<string | undefined> = []
    const objectAuthorizations: Array<string | undefined> = []
    const objectBypasses: Array<string | undefined> = []
    let objectPath = ''
    const storage = createServer((req, res) => {
      objectPath = req.url ?? ''
      objectAuthorizations.push(req.headers.authorization)
      objectBypasses.push(
        req.headers['x-ratelimit-bypass'] as string | undefined,
      )
      res.writeHead(200, { 'content-type': 'image/jpeg' }).end(payload)
    })
    const storageOrigin = await listen(storage)
    const pds = createServer((req, res) => {
      pdsAuthorizations.push(req.headers.authorization)
      if (req.headers.authorization !== adminAuthorization) {
        res.writeHead(401).end()
        return
      }
      res.writeHead(307, {
        location: `${storageOrigin}/synthetic?signature=fixture`,
        'cache-control': 'no-store',
      })
      res.end()
    })
    const pdsOrigin = await listen(pds)
    const ctx = context(pdsOrigin, true)
    try {
      expect(await proxyRequest(ctx)).toEqual(payload)
      expect(pdsAuthorizations).toHaveLength(1)
      expect(pdsAuthorizations).toEqual([adminAuthorization])
      expect(objectAuthorizations).toEqual([undefined])
      expect(objectBypasses).toEqual([undefined])
      expect(objectPath).toBe('/synthetic?signature=fixture')
    } finally {
      await ctx.blobDispatcher.close()
      await Promise.all([close(pds), close(storage)])
    }
  })

  it('strips both credentials on same-origin redirects too', async () => {
    const authorizations: Array<string | undefined> = []
    const bypasses: Array<string | undefined> = []
    const pds = createServer((req, res) => {
      authorizations.push(req.headers.authorization)
      bypasses.push(req.headers['x-ratelimit-bypass'] as string | undefined)
      if (req.url?.startsWith('/xrpc/')) {
        res.writeHead(307, { location: '/synthetic?signature=fixture' }).end()
      } else {
        res.end(payload)
      }
    })
    const ctx = context(await listen(pds), true)
    try {
      expect(await proxyRequest(ctx)).toEqual(payload)
      expect(authorizations).toEqual([adminAuthorization, undefined])
      expect(authorizations[1]).toBeUndefined()
      expect(bypasses).toEqual(['synthetic-bypass', undefined])
    } finally {
      await ctx.blobDispatcher.close()
      await close(pds)
    }
  })

  it('does not add credentials by default', async () => {
    let authorization: string | undefined
    const pds = createServer((req, res) => {
      authorization = req.headers.authorization
      res.writeHead(200).end(payload)
    })
    const ctx = context(await listen(pds))
    try {
      expect(await proxyRequest(ctx)).toEqual(payload)
      expect(authorization).toBeUndefined()
    } finally {
      await ctx.blobDispatcher.close()
      await close(pds)
    }
  })

  it('does not attach the credential to another origin', async () => {
    let authorization: string | undefined
    const pds = createServer((req, res) => {
      authorization = req.headers.authorization
      res.writeHead(200).end(payload)
    })
    const ctx = context(await listen(pds), true, false, 'https://other.test')
    try {
      expect(await proxyRequest(ctx)).toEqual(payload)
      expect(authorization).toBeUndefined()
    } finally {
      await ctx.blobDispatcher.close()
      await close(pds)
    }
  })

  it('does not send the credential to another port on the same hostname', async () => {
    let authorization: string | undefined
    const pds = createServer((req, res) => {
      authorization = req.headers.authorization
      res.writeHead(200).end(payload)
    })
    const pdsOrigin = await listen(pds)
    const otherOrigin = new URL(pdsOrigin)
    otherOrigin.port = '1'
    const ctx = context(pdsOrigin, true, false, otherOrigin.origin)
    try {
      expect(await proxyRequest(ctx)).toEqual(payload)
      expect(authorization).toBeUndefined()
    } finally {
      await ctx.blobDispatcher.close()
      await close(pds)
    }
  })

  it('still checks the CID after the redirect', async () => {
    const storage = createServer((_req, res) => res.end('wrong body'))
    const storageOrigin = await listen(storage)
    const pds = createServer((_req, res) => {
      res.writeHead(307, { location: storageOrigin }).end()
    })
    const ctx = context(await listen(pds), true)
    try {
      await expect(proxyRequest(ctx)).rejects.toThrow('404: Bad cid check')
    } finally {
      await ctx.blobDispatcher.close()
      await Promise.all([close(pds), close(storage)])
    }
  })

  it('cancels the active object-store request', async () => {
    let requestStarted: (() => void) | undefined
    let socketClosed: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve
    })
    const closed = new Promise<void>((resolve) => {
      socketClosed = resolve
    })
    const storage = createServer((_req, res) => {
      res.on('close', () => socketClosed?.())
      res.writeHead(200, { 'content-type': 'image/jpeg' })
      res.flushHeaders()
      requestStarted?.()
    })
    const storageOrigin = await listen(storage)
    const pds = createServer((_req, res) => {
      res.writeHead(307, { location: storageOrigin }).end()
    })
    const ctx = context(await listen(pds), true)
    const abort = new AbortController()
    try {
      const request = proxyRequest(ctx, abort.signal)
      const expectation = expect(request).rejects.toMatchObject({
        name: 'AbortError',
      })
      await started
      abort.abort()
      await expectation
      await closed
    } finally {
      await ctx.blobDispatcher.close()
      await Promise.all([close(pds), close(storage)])
    }
  })

  it('checks takedown state before contacting the PDS', async () => {
    let requests = 0
    const pds = createServer((_req, res) => {
      requests++
      res.end(payload)
    })
    const ctx = context(await listen(pds), true, true)
    try {
      await expect(proxyRequest(ctx)).rejects.toThrow('404: Blob not found')
      expect(requests).toBe(0)
    } finally {
      await ctx.blobDispatcher.close()
      await close(pds)
    }
  })
})
