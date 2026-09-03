import {
  Code,
  ConnectError,
  type UnaryRequest,
  type UnaryResponse,
} from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRpcClientInterceptor } from './rpc.js'

const otel = vi.hoisted(() => {
  const span = {
    end: vi.fn(),
    recordException: vi.fn(),
    setAttributes: vi.fn(),
    setStatus: vi.fn(),
  }
  return {
    inject: vi.fn(),
    record: vi.fn(),
    span,
    startActiveSpan: vi.fn(
      (
        _name: string,
        _options: unknown,
        callback: (activeSpan: typeof span) => unknown,
      ) => callback(span),
    ),
  }
})

vi.mock('@opentelemetry/api', () => ({
  SpanKind: { CLIENT: 2 },
  SpanStatusCode: { ERROR: 2 },
  ValueType: { DOUBLE: 1 },
  context: { active: vi.fn(() => ({})) },
  metrics: {
    getMeter: () => ({ createHistogram: () => ({ record: otel.record }) }),
  },
  propagation: { inject: otel.inject },
  trace: { getTracer: () => ({ startActiveSpan: otel.startActiveSpan }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const fakeRequest = () =>
  ({
    header: new Headers(),
    method: { name: 'PutOperation' },
    service: { typeName: 'bsync.Service' },
  }) as UnaryRequest

describe('createRpcClientInterceptor', () => {
  it('records successful calls with custom attributes', async () => {
    const req = fakeRequest()
    const response = {} as UnaryResponse
    const next = createRpcClientInterceptor(() => ({
      'bsync.namespace': 'app.bsky.bookmark.defs#bookmark',
    }))(vi.fn(async () => response))

    await expect(next(req)).resolves.toBe(response)

    expect(otel.inject).toHaveBeenCalledWith(
      expect.anything(),
      req.header,
      expect.anything(),
    )
    expect(otel.record).toHaveBeenCalledWith(expect.any(Number), {
      'bsync.namespace': 'app.bsky.bookmark.defs#bookmark',
      'rpc.method': 'bsync.Service/PutOperation',
      'rpc.response.status_code': 'ok',
      'rpc.system.name': 'connectrpc',
    })
    expect(otel.span.end).toHaveBeenCalledOnce()
  })

  it('records Connect error status', async () => {
    const err = new ConnectError('unavailable', Code.Unavailable)
    const next = createRpcClientInterceptor(
      vi.fn(() => ({
        'bsync.namespace': 'app.bsky.bookmark.defs#bookmark',
      })),
    )(
      vi.fn(async () => {
        throw err
      }),
    )

    await expect(next(fakeRequest())).rejects.toBe(err)

    expect(otel.record).toHaveBeenCalledWith(expect.any(Number), {
      'bsync.namespace': 'app.bsky.bookmark.defs#bookmark',
      'error.type': 'unavailable',
      'rpc.method': 'bsync.Service/PutOperation',
      'rpc.response.status_code': 'unavailable',
      'rpc.system.name': 'connectrpc',
    })
    expect(otel.span.recordException).toHaveBeenCalledWith(err)
    expect(otel.span.setStatus).toHaveBeenCalledWith({ code: 2 })
    expect(otel.span.end).toHaveBeenCalledOnce()
  })
})
