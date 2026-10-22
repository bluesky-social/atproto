import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { pino } from 'pino'
import { startTime } from 'pino-http'
import { describe, expect, it, test, vi } from 'vitest'
import { createLoggerMiddleware, httpLogger } from './logger.js'

describe(createLoggerMiddleware, () => {
  it('retains every completion when sampling is disabled', () => {
    using random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { req, res, logs } = createRequest(1)
    complete(res)
    expect(logs()).toMatchObject([
      { level: 30, msg: 'request completed', req: { id: req.id } },
    ])
    expect(random).not.toHaveBeenCalled()
  })

  test.each([
    { rate: 0, random: 0, retained: false },
    { rate: 0.1, random: 0.099, retained: true },
    { rate: 0.1, random: 0.1, retained: false },
    { rate: 0.1, random: 0.9, retained: false },
  ])('rate $rate, random $random', ({ rate, random, retained }) => {
    using _rng = vi.spyOn(Math, 'random').mockReturnValue(random)
    const { res, logs } = createRequest(rate)
    complete(res)
    expect(logs()).toHaveLength(retained ? 1 : 0)
  })

  test.each([400, 404, 429, 500, 503])('retains HTTP %i failures', (status) => {
    const { res, logs } = createRequest(0)
    res.statusCode = status
    complete(res)
    expect(logs()).toMatchObject([{ level: 30, res: { statusCode: status } }])
  })

  it('retains response errors with a successful HTTP status', () => {
    const { res, logs } = createRequest(0)
    res.err = new Error('response failed')
    complete(res)
    expect(logs()).toMatchObject([
      { msg: 'request errored', err: { message: 'response failed' } },
    ])
  })

  it('retains errors emitted before a response completes', () => {
    const { res, logs } = createRequest(0)
    res.emit('error', new Error('connection failed'))
    res.emit('close')
    expect(logs()).toMatchObject([
      { msg: 'request errored', err: { message: 'connection failed' } },
    ])
  })

  it('retains aborted responses exactly once', () => {
    const { res, logs } = createRequest(0)
    res.emit('close')
    res.emit('finish')
    expect(logs()).toMatchObject([{ msg: 'request aborted' }])
  })

  it('retains responses destroyed after end but before completion', () => {
    const { res, logs } = createRequest(0)
    res.end()
    res.destroy()
    res.emit('close')
    expect(logs()).toHaveLength(1)
  })

  it('retains aborted requests even after the response ends', () => {
    const { req, res, logs } = createRequest(0)
    req.destroy()
    complete(res)
    expect(logs()).toMatchObject([{ msg: 'request aborted' }])
  })

  test.each([
    { elapsed: 999, slowRequestMs: 1000, retained: false },
    { elapsed: 1000, slowRequestMs: 1000, retained: true },
    { elapsed: 1500, slowRequestMs: 1000, retained: true },
    { elapsed: 500, slowRequestMs: 500, retained: true },
  ])(
    'elapsed $elapsed, threshold $slowRequestMs',
    ({ elapsed, slowRequestMs, retained }) => {
      using _now = vi.spyOn(Date, 'now').mockReturnValue(10_000)
      const { res, logs } = createRequest(0, slowRequestMs)
      res[startTime] = 10_000 - elapsed
      complete(res)
      expect(logs()).toHaveLength(retained ? 1 : 0)
      if (retained) expect(logs()[0].responseTime).toBe(elapsed)
    },
  )

  it('retains request diagnostics and header redaction on sampled requests', () => {
    const { req, res, logs } = createRequest(0)
    req.log.info('handler info before completion')
    req.log.warn({ detail: 'diagnostic' }, 'handler warning')
    complete(res)
    req.log.info('handler info after completion')
    expect(logs()).toMatchObject([
      { level: 30, msg: 'handler info before completion' },
      {
        level: 40,
        msg: 'handler warning',
        detail: 'diagnostic',
        req: { headers: { authorization: 'Bearer ***' } },
      },
      { level: 30, msg: 'handler info after completion' },
    ])
  })
})

function createRequest(successSampleRate: number, slowRequestMs = 1000) {
  const lines: string[] = []
  const logger = pino({ level: 'info' }, { write: (line) => lines.push(line) })
  using _child = vi
    .spyOn(httpLogger, 'child')
    .mockImplementation((bindings, options) => logger.child(bindings, options))
  const middleware = createLoggerMiddleware({
    httpLogSuccessSampleRate: successSampleRate,
    httpLogSlowRequestMs: slowRequestMs,
  })
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = '/test'
  req.headers = { authorization: 'Bearer secret' }
  const res = new ServerResponse(req)
  middleware(req, res)
  return { req, res, logs: () => lines.map((line) => JSON.parse(line)) }
}

function complete(res: ServerResponse) {
  res.end()
  res.emit('finish')
}
