import { once } from 'node:events'
import {
  Agent,
  type ClientRequest,
  type IncomingMessage,
  type ServerResponse,
  createServer,
  request,
} from 'node:http'
import type { Socket } from 'node:net'
import { setTimeout } from 'node:timers'
import { pino } from 'pino'
import { assert, describe, expect, it, test, vi } from 'vitest'
import { createDeferrable } from '@atproto/common'
import { createLoggerMiddleware, httpLogger } from './logger.js'

describe('HTTP access log sampling over real connections', () => {
  test.each([
    { keepAlive: true, rate: 0, completions: 0 },
    { keepAlive: false, rate: 0, completions: 0 },
    { keepAlive: true, rate: 1, completions: 10 },
    { keepAlive: false, rate: 1, completions: 10 },
    { keepAlive: true, rate: 0.1, completions: 1 },
    { keepAlive: false, rate: 0.1, completions: 1 },
  ])(
    'keepAlive $keepAlive, sample rate $rate',
    async ({ keepAlive, rate, completions }) => {
      let sample = 0
      using _random = vi
        .spyOn(Math, 'random')
        .mockImplementation(() => 0.05 + 0.1 * sample++)
      const completed: Lifecycle[] = []
      await using http = await startHttpServer(
        { rate, keepAlive },
        (req, res) => {
          req.log.info('handler before completion')
          res.once('finish', () => {
            completed.push(lifecycle(req, res))
            req.log.info('handler after completion')
          })
          res.end('ok')
        },
      )

      for (let index = 0; index < 10; index++) {
        expect(await http.get('/', { authorization: 'Bearer secret' })).toBe(
          200,
        )
      }

      expect(http.connectionCount).toBe(keepAlive ? 1 : 10)
      expect(
        http.logs.filter((log) => log.msg === 'request completed'),
      ).toHaveLength(completions)
      expect(
        http.logs.filter((log) => log.msg === 'handler before completion'),
      ).toHaveLength(10)
      expect(
        http.logs.filter((log) => log.msg === 'handler after completion'),
      ).toHaveLength(10)
      expect(http.logs).toHaveLength(completions + 20)
      expect(
        new Set(http.logs.map((log) => log.req.headers.authorization)),
      ).toEqual(new Set(['Bearer ***']))
      expect(completed).toEqual(
        Array.from({ length: 10 }, () => ({
          readableAborted: false,
          writableEnded: true,
          writableFinished: true,
          destroyed: false,
        })),
      )
    },
  )

  test.each([400, 500])(
    'retains HTTP %i failures at sample rate zero',
    async (status) => {
      await using http = await startHttpServer({ rate: 0 }, (_req, res) => {
        res.statusCode = status
        res.end('failure')
      })
      expect(await http.get()).toBe(status)
      expect(http.logs).toMatchObject([
        { level: 30, res: { statusCode: status } },
      ])
    },
  )

  it('retains HTTP 200 responses carrying an error at sample rate zero', async () => {
    await using http = await startHttpServer({ rate: 0 }, (_req, res) => {
      res.err = new Error('response failed')
      res.end('error already handled')
    })
    expect(await http.get()).toBe(200)
    expect(http.logs).toMatchObject([
      {
        level: 30,
        msg: 'request errored',
        res: { statusCode: 200 },
        err: { message: 'response failed' },
      },
    ])
  })

  it('retains slow successful responses at sample rate zero', async () => {
    await using http = await startHttpServer(
      { rate: 0, slowRequestMs: 5 },
      (_req, res) => {
        setTimeout(() => res.end('slow success'), 30)
      },
    )
    expect(await http.get()).toBe(200)
    expect(http.logs).toMatchObject([
      { msg: 'request completed', res: { statusCode: 200 } },
    ])
    expect(http.logs[0].responseTime).toBeGreaterThanOrEqual(5)
  })

  it('retains a client abort after a partial HTTP 200 response exactly once', async () => {
    const closed = createDeferrable<Lifecycle>()
    await using http = await startHttpServer({ rate: 0 }, (req, res) => {
      res.once('close', () => closed.resolve(lifecycle(req, res)))
      res.writeHead(200)
      res.write('partial response')
    })
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = http.openRequest('/', {}, (res) => {
        res.once('data', () => res.destroy())
        res.once('close', () => resolve(res.statusCode))
        res.once('error', reject)
      })
      req.once('error', reject)
      req.end()
    })
    expect(status).toBe(200)
    expect(await closed.complete).toMatchObject({
      writableEnded: false,
      writableFinished: false,
      destroyed: true,
    })
    expect(http.logs).toMatchObject([
      { level: 30, msg: 'request aborted', res: { statusCode: 200 } },
    ])
  })

  it('retains an aborted upload with an incomplete request body', async () => {
    const closed = createDeferrable<Lifecycle>()
    const bodyErrors: Error[] = []
    await using http = await startHttpServer({ rate: 0 }, (req, res) => {
      req.once('data', () => client.destroy())
      req.once('error', (err) => bodyErrors.push(err))
      res.once('close', () => closed.resolve(lifecycle(req, res)))
    })
    const client = http.openRequest(
      '/upload',
      { 'content-length': '100' },
      () => {},
      'POST',
    )
    const clientErrors: Error[] = []
    client.once('error', (err) => clientErrors.push(err))
    const clientClosed = new Promise<void>((resolve) =>
      client.once('close', () => resolve()),
    )
    client.write('partial body')
    await clientClosed
    expect(await closed.complete).toEqual({
      readableAborted: true,
      writableEnded: false,
      writableFinished: false,
      destroyed: true,
    })
    expect(clientErrors).toMatchObject([{ code: 'ECONNRESET' }])
    expect(bodyErrors).toMatchObject([{ code: 'ECONNRESET' }])
    expect(http.logs).toMatchObject([{ level: 30, msg: 'request aborted' }])
  })
})

type Lifecycle = {
  readableAborted: boolean
  writableEnded: boolean
  writableFinished: boolean
  destroyed: boolean
}

type HttpLog = {
  level: number
  msg: string
  req: { headers: Record<string, string> }
  responseTime?: number
}

function lifecycle(req: IncomingMessage, res: ServerResponse): Lifecycle {
  return {
    readableAborted: req.readableAborted,
    writableEnded: res.writableEnded,
    writableFinished: res.writableFinished,
    destroyed: res.destroyed,
  }
}

async function startHttpServer(
  config: { rate: number; keepAlive?: boolean; slowRequestMs?: number },
  handler: (req: IncomingMessage, res: ServerResponse) => void,
) {
  const logs: HttpLog[] = []
  const logger = pino(
    { level: 'info' },
    {
      write: (line) => logs.push(JSON.parse(line)),
    },
  )
  using _child = vi
    .spyOn(httpLogger, 'child')
    .mockImplementation((bindings, options) => logger.child(bindings, options))
  const middleware = createLoggerMiddleware({
    httpLogSuccessSampleRate: config.rate,
    httpLogSlowRequestMs: config.slowRequestMs ?? 60_000,
  })
  const serverSockets = new Set<Socket>()
  const clientSockets = new Set<Socket>()
  let connectionCount = 0
  const server = createServer((req, res) => {
    middleware(req, res)
    handler(req, res)
  })
  server.on('connection', (socket) => {
    connectionCount++
    serverSockets.add(socket)
    socket.once('close', () => serverSockets.delete(socket))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address !== 'string')
  const port = address.port
  const agent = new Agent({
    keepAlive: config.keepAlive ?? true,
    maxSockets: 1,
  })

  function openRequest(
    path: string,
    headers: Record<string, string>,
    onResponse: (res: IncomingMessage) => void,
    method = 'GET',
  ): ClientRequest {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        agent,
        timeout: 2000,
        headers: {
          connection: config.keepAlive === false ? 'close' : 'keep-alive',
          ...headers,
        },
      },
      onResponse,
    )
    req.once('socket', (socket) => {
      if (!clientSockets.has(socket)) {
        clientSockets.add(socket)
        socket.once('close', () => clientSockets.delete(socket))
      }
    })
    req.once('timeout', () =>
      req.destroy(new Error('HTTP test request timed out')),
    )
    return req
  }

  return {
    logs,
    openRequest,
    get connectionCount() {
      return connectionCount
    },
    get(
      path = '/',
      headers: Record<string, string> = {},
    ): Promise<number | undefined> {
      return new Promise((resolve, reject) => {
        const req = openRequest(path, headers, (res) => {
          res.once('end', () => resolve(res.statusCode))
          res.once('error', reject)
          res.resume()
        })
        req.once('error', reject)
        req.end()
      })
    },
    async [Symbol.asyncDispose]() {
      const closed = [...serverSockets, ...clientSockets].map(
        (socket) =>
          new Promise<void>((resolve) => socket.once('close', () => resolve())),
      )
      agent.destroy()
      server.closeAllConnections()
      await server[Symbol.asyncDispose]()
      await Promise.all(closed)
    },
  }
}
