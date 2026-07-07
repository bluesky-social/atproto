import { Code, ConnectError } from '@connectrpc/connect'
import {
  SpanKind,
  SpanStatusCode,
  propagation,
  trace,
} from '@opentelemetry/api'
import { core, tracing } from '@opentelemetry/sdk-node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { tracingInterceptor } from './rpc-tracing.js'

type AnyFn = Parameters<ReturnType<typeof tracingInterceptor>>[0]
type AnyReq = Parameters<AnyFn>[0]

const makeReq = (): AnyReq =>
  ({
    stream: false,
    service: { typeName: 'bsky.Service' },
    method: { name: 'GetPostThread' },
    url: 'https://dataplane.example:2543/bsky.Service/GetPostThread',
    header: new Headers(),
  }) as AnyReq

const okResponse = {} as Awaited<ReturnType<AnyFn>>

describe('tracingInterceptor', () => {
  const exporter = new tracing.InMemorySpanExporter()
  const provider = new tracing.BasicTracerProvider({
    spanProcessors: [new tracing.SimpleSpanProcessor(exporter)],
  })

  beforeAll(() => {
    trace.setGlobalTracerProvider(provider)
    propagation.setGlobalPropagator(new core.W3CTraceContextPropagator())
  })

  afterEach(() => {
    exporter.reset()
  })

  afterAll(async () => {
    trace.disable()
    propagation.disable()
    await provider.shutdown()
  })

  it('creates a client span and injects trace context', async () => {
    const req = makeReq()
    const next: AnyFn = async () => okResponse
    const res = await tracingInterceptor({
      rpcSystem: 'grpc',
      peerService: 'atlantis',
      peerInterface: 'dataplane',
    })(next)(req)
    expect(res).toBe(okResponse)

    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    const span = spans[0]
    expect(span.name).toBe('bsky.Service/GetPostThread')
    expect(span.kind).toBe(SpanKind.CLIENT)
    expect(span.attributes).toMatchObject({
      'rpc.system.name': 'grpc',
      'rpc.method': 'bsky.Service/GetPostThread',
      'server.address': 'dataplane.example',
      'server.port': 2543,
      'peer.service': 'atlantis',
      'peer.interface': 'dataplane',
    })
    expect(req.header.get('traceparent')).toContain(span.spanContext().traceId)
  })

  it('records grpc status code on ConnectError', async () => {
    const req = makeReq()
    const next: AnyFn = async () => {
      throw new ConnectError('unavailable', Code.Unavailable)
    }
    await expect(
      tracingInterceptor({ rpcSystem: 'grpc' })(next)(req),
    ).rejects.toThrow(ConnectError)

    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.attributes['rpc.response.status_code']).toBe('UNAVAILABLE')
    expect(span.attributes['error.type']).toBe('UNAVAILABLE')
  })

  it('records connect error code on ConnectError', async () => {
    const req = makeReq()
    const next: AnyFn = async () => {
      throw new ConnectError('nope', Code.NotFound)
    }
    await expect(tracingInterceptor()(next)(req)).rejects.toThrow(ConnectError)

    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.attributes['rpc.response.status_code']).toBe('not_found')
    expect(span.attributes['error.type']).toBe('not_found')
    expect(span.status.message).toBe('not_found')
  })

  it('records error status on non-connect errors', async () => {
    const req = makeReq()
    const next: AnyFn = async () => {
      throw new Error('boom')
    }
    await expect(tracingInterceptor()(next)(req)).rejects.toThrow('boom')

    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.attributes['error.type']).toBe('Error')
    expect(span.status.message).toBe('boom')
  })
})

describe('tracingInterceptor without an SDK', () => {
  it('passes the request through as a no-op', async () => {
    const req = makeReq()
    const next: AnyFn = async () => okResponse
    const res = await tracingInterceptor()(next)(req)
    expect(res).toBe(okResponse)
  })
})
