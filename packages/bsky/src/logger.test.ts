import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cidForRawHash } from '@atproto/lex-data'
import { createBlobDispatcher } from './api/blob-dispatcher.js'
import { createMiddleware } from './api/blob-resolver.js'
import type { AppContext } from './context.js'
import { loggerMiddleware, recordBlobUpstreamDuration } from './logger.js'

const logs = vi.hoisted(() => [] as string[])

vi.mock('@atproto/common', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const { pino } = await import('pino')
  return {
    ...original,
    subsystemLogger: () =>
      pino({}, { write: (line: string) => logs.push(line) }),
  }
})

afterEach(() => {
  logs.length = 0
})

describe('HTTP logger', () => {
  it('redacts cookies from the actual request and response log', async () => {
    const server = createServer((req, res) => {
      loggerMiddleware(req, res)
      recordBlobUpstreamDuration(res, 12.5)
      res.setHeader('set-cookie', ['session=response-secret; HttpOnly'])
      res.setHeader('content-type', 'text/plain')
      res.statusCode = 201
      res.end('ok')
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
      const address = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${address.port}`, {
        headers: { cookie: 'session=request-secret' },
      })
      expect(response.status).toBe(201)
      expect(response.headers.get('set-cookie')).toContain('response-secret')
      await response.text()
      expect(logs).toHaveLength(1)
      const log = JSON.parse(logs[0])
      expect(log.req.headers.cookie).toBe('[Redacted]')
      expect(log.res.headers['set-cookie']).toBe('[Redacted]')
      expect(log.res.headers['content-type']).toBe('text/plain')
      expect(log.res.statusCode).toBe(201)
      expect(log.upstream_ms).toBe(12.5)
      expect(logs[0]).not.toContain('request-secret')
      expect(logs[0]).not.toContain('response-secret')
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    }
  })

  it('logs blob upstream duration without exposing or forwarding authorization', async () => {
    const did = 'did:plc:abcdefghijklmnopqrstuvwx'
    const payload = Buffer.from('synthetic verified blob')
    const cid = cidForRawHash(createHash('sha256').update(payload).digest())
    const stalledCid = cidForRawHash(
      createHash('sha256').update('stalled synthetic blob').digest(),
    )
    let notifyStalledRequest: (() => void) | undefined
    const stalledRequest = new Promise<void>((resolve) => {
      notifyStalledRequest = resolve
    })
    let pdsAuthorization: string | undefined
    const pds = createServer((req, res) => {
      pdsAuthorization = req.headers.authorization
      if (req.url?.includes(stalledCid.toString())) {
        notifyStalledRequest?.()
        return
      }
      res.writeHead(200, { 'content-type': 'image/jpeg' }).end(payload)
    })
    pds.listen(0, '127.0.0.1')
    await once(pds, 'listening')
    const pdsAddress = pds.address() as AddressInfo
    const pdsOrigin = `http://127.0.0.1:${pdsAddress.port}`
    const cfg = {
      disableSsrfProtection: true,
      proxyAllowHTTP2: false,
      proxyBodyTimeout: 30e3,
      proxyHeadersTimeout: 30e3,
      proxyMaxResponseSize: 10 * 1024 * 1024,
      proxyMaxRetries: 0,
      proxyPreferCompressed: false,
    } as AppContext['cfg']
    const dispatcher = createBlobDispatcher(cfg)
    const ctx = {
      cfg,
      blobDispatcher: dispatcher,
      dataplane: {
        getIdentityByDid: async () => ({
          services: new TextEncoder().encode(
            JSON.stringify({
              atproto_pds: {
                Type: 'AtprotoPersonalDataServer',
                URL: pdsOrigin,
              },
            }),
          ),
        }),
        getBlobTakedown: async () => ({ takenDown: false }),
      },
    } as unknown as AppContext
    const middleware = createMiddleware(ctx)
    const appview = createServer((req, res) => {
      loggerMiddleware(req, res)
      void (async () => {
        await middleware(req, res, () => {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ message: 'Internal error' }))
        })
      })().catch(() => {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ message: 'Internal error' }))
      })
    })
    appview.listen(0, '127.0.0.1')
    await once(appview, 'listening')
    const address = appview.address() as AddressInfo
    const authorization = 'Bearer synthetic-blob-request-secret'
    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/blob/${did}/${cid}`,
        { headers: { authorization } },
      )
      const bytes = Buffer.from(await response.arrayBuffer())

      expect(response.status).toBe(200)
      expect(bytes).toEqual(payload)
      expect(pdsAuthorization).toBeUndefined()
      expect(logs).toHaveLength(1)
      const output = JSON.parse(logs[0])
      expect(output.upstream_ms).toEqual(expect.any(Number))
      expect(output.upstream_ms).toBeGreaterThanOrEqual(0)
      expect(logs[0]).not.toContain(authorization)

      const controller = new AbortController()
      const abortedResponse = fetch(
        `http://127.0.0.1:${address.port}/blob/${did}/${stalledCid}`,
        { signal: controller.signal },
      )
      await stalledRequest
      controller.abort()
      await expect(abortedResponse).rejects.toThrow()
      await vi.waitFor(() => {
        const accessLogs = logs
          .map((line) => JSON.parse(line))
          .filter((entry) => entry.req && entry.res)
        expect(accessLogs).toHaveLength(2)
        expect(accessLogs[1].upstream_ms).toEqual(expect.any(Number))
      })
      expect(logs.every((line) => !line.includes(authorization))).toBe(true)
    } finally {
      await dispatcher.close()
      for (const server of [appview, pds]) {
        server.closeAllConnections()
        server.close()
        await once(server, 'close')
      }
    }
  })
})
