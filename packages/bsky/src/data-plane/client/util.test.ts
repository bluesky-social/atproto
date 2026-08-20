import {
  Code,
  ConnectError,
  type StreamRequest,
  type StreamResponse,
  type UnaryRequest,
  type UnaryResponse,
} from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callerInterceptor, otelInterceptor } from './util.js'

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
    method: { name: 'GetProfile' },
    service: { typeName: 'bsky.Service' },
  }) as UnaryRequest

describe('otelInterceptor', () => {
  it('records successful calls', async () => {
    const req = fakeRequest()
    const response = {} as UnaryResponse
    const next = otelInterceptor(vi.fn(async () => response))

    await expect(next(req)).resolves.toBe(response)

    expect(otel.startActiveSpan).toHaveBeenCalledWith(
      'bsky.Service/GetProfile',
      {
        kind: 2,
        attributes: {
          'rpc.method': 'GetProfile',
          'rpc.service': 'bsky.Service',
          'rpc.system': 'grpc',
        },
      },
      expect.any(Function),
    )
    expect(otel.inject).toHaveBeenCalledWith(
      expect.anything(),
      req.header,
      expect.anything(),
    )
    expect(otel.record).toHaveBeenCalledWith(expect.any(Number), {
      'rpc.grpc.status_code': 0,
      'rpc.method': 'GetProfile',
      'rpc.service': 'bsky.Service',
      'rpc.system': 'grpc',
    })
    expect(otel.span.end).toHaveBeenCalledOnce()
  })

  it('records Connect error status', async () => {
    const err = new ConnectError('unavailable', Code.Unavailable)
    const next = otelInterceptor(
      vi.fn(async () => {
        throw err
      }),
    )

    await expect(next(fakeRequest())).rejects.toBe(err)

    expect(otel.record).toHaveBeenCalledWith(expect.any(Number), {
      'rpc.grpc.status_code': Code.Unavailable,
      'rpc.method': 'GetProfile',
      'rpc.service': 'bsky.Service',
      'rpc.system': 'grpc',
    })
    expect(otel.span.recordException).toHaveBeenCalledWith(err)
    expect(otel.span.setStatus).toHaveBeenCalledWith({ code: 2 })
    expect(otel.span.end).toHaveBeenCalledOnce()
  })
})

describe('callerInterceptor', () => {
  it('sets x-atlantis-caller header on the request', async () => {
    const fakeRequest = { header: new Headers({ 'x-other': 'value' }) } as
      UnaryRequest | StreamRequest
    const fakeResponse = {} as UnaryResponse | StreamResponse
    const fakeHandler = vi.fn(async (_req: UnaryRequest | StreamRequest) => {
      return fakeResponse
    })

    const interceptor = callerInterceptor('appview')
    const next = interceptor(fakeHandler)
    const res = await next(fakeRequest)

    expect(fakeRequest.header.get('x-atlantis-caller')).toBe('appview')
    expect(fakeRequest.header.get('x-other')).toBe('value')
    expect(fakeHandler).toHaveBeenCalledWith(fakeRequest)
    expect(res).toBe(fakeResponse)
  })
})
