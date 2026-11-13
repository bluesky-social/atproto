import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loggerMiddleware } from './logger.js'

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
      expect(logs[0]).not.toContain('request-secret')
      expect(logs[0]).not.toContain('response-secret')
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    }
  })
})
