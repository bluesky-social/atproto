import { Code, ConnectError } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../lexicons/index.js'
import { events } from './events.js'

const otel = vi.hoisted(() => ({
  add: vi.fn<(value: number, attributes: Record<string, unknown>) => void>(),
  emit: vi.fn(),
  record: vi.fn<(name: string, value: number, attributes: object) => void>(),
  diagError: vi.fn(),
}))

vi.mock('@opentelemetry/api', () => ({
  SeverityNumber: { INFO: 9 },
  ValueType: { INT: 1, DOUBLE: 2 },
  diag: { error: otel.diagError },
  logs: { getLogger: () => ({ emit: otel.emit }) },
  metrics: {
    getMeter: () => ({
      createCounter: () => ({ add: otel.add }),
      createHistogram: (name: string) => ({
        record: (value: number, attributes: object) =>
          otel.record(name, value, attributes),
      }),
    }),
  },
}))

const pino = vi.hoisted(() => ({ info: vi.fn() }))
vi.mock('../logger.js', () => ({
  eventsLogger: pino,
}))

beforeEach(() => {
  // Reset implementations too: a test may make a sink throw.
  vi.resetAllMocks()
})

describe('hydrationFailed', () => {
  // The hydration calls run with AbortSignal.timeout(). Connect does not
  // propagate the DOMException it raises: it wraps it in a ConnectError with
  // code Internal, leaving the original on `cause`. Reproduced from a live
  // gRPC call against a non-responding server.
  const abortError = () =>
    ConnectError.from(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
      Code.Internal,
    )

  it('classifies our own AbortSignal.timeout() as `abort`', () => {
    events.hydrationFailed({ source: 'known_likers', err: abortError() })

    expect(otel.add).toHaveBeenCalledWith(1, {
      source: 'known_likers',
      reason: 'abort',
    })
    expect(otel.emit).toHaveBeenCalledWith({
      eventName: 'hydration_failed',
      severityNumber: 9,
      attributes: { source: 'known_likers', reason: 'abort' },
    })
  })

  it('classifies a dataplane deadline as `timeout`', () => {
    events.hydrationFailed({
      source: 'known_likers',
      err: new ConnectError('context deadline exceeded', Code.DeadlineExceeded),
    })

    expect(otel.add).toHaveBeenCalledWith(1, {
      source: 'known_likers',
      reason: 'timeout',
    })
    expect(otel.emit).toHaveBeenCalledWith({
      eventName: 'hydration_failed',
      severityNumber: 9,
      attributes: { source: 'known_likers', reason: 'timeout' },
    })
  })

  it('classifies any other failure as `error`', () => {
    events.hydrationFailed({
      source: 'known_followers',
      err: new ConnectError('unavailable', Code.Unavailable),
    })

    expect(otel.add).toHaveBeenCalledWith(1, {
      source: 'known_followers',
      reason: 'error',
    })
    expect(otel.emit).toHaveBeenCalledWith({
      eventName: 'hydration_failed',
      severityNumber: 9,
      attributes: { source: 'known_followers', reason: 'error' },
    })
  })

  it('classifies a cancellation as `error`', () => {
    const ac = new AbortController()
    ac.abort()

    events.hydrationFailed({
      source: 'activity_subscriptions',
      err: ConnectError.from(ac.signal.reason, Code.Canceled),
    })

    expect(otel.add).toHaveBeenCalledWith(1, {
      source: 'activity_subscriptions',
      reason: 'error',
    })
  })
})

describe('externalHydrationTraversal', () => {
  const summary = {
    xrpcEndpoint: app.bsky.unspecced.getAtmosphereExploreTab.$lxm,
    root: 'uris',
    outcome: 'capped',
    durationMs: 12.5,
    recordLookups: 24,
    batches: 8,
    maxPass: 8,
    roots: 3,
    rootsResolved: 3,
    dependencies: 21,
    dependenciesResolved: 17,
  } as const

  it('records totals with bounded attributes and logs the summary', () => {
    events.externalHydrationTraversal(summary)

    const attributes = {
      xrpcEndpoint: app.bsky.unspecced.getAtmosphereExploreTab.$lxm,
      root: 'uris',
      outcome: 'capped',
    }
    expect(otel.record.mock.calls).toEqual([
      ['hydration.external.record_lookups', 24, attributes],
      ['hydration.external.batches', 8, attributes],
      ['hydration.external.duration', 12.5, attributes],
    ])
    // Every status is added, including zeros.
    const xrpcEndpoint = app.bsky.unspecced.getAtmosphereExploreTab.$lxm
    expect(otel.add.mock.calls).toEqual([
      [3, { xrpcEndpoint, kind: 'root', status: 'resolved' }],
      [0, { xrpcEndpoint, kind: 'root', status: 'unresolved' }],
      [17, { xrpcEndpoint, kind: 'dependency', status: 'resolved' }],
      [4, { xrpcEndpoint, kind: 'dependency', status: 'unresolved' }],
    ])
    expect(otel.emit).toHaveBeenCalledWith({
      eventName: 'external_hydration_traversal',
      severityNumber: 9,
      attributes: summary,
    })
    expect(pino.info).toHaveBeenCalledWith({
      eventName: 'external_hydration_traversal',
      ...summary,
    })
  })

  it('forwards a partial outcome and unknown XRPC endpoint unchanged to every sink', () => {
    const partial = {
      ...summary,
      xrpcEndpoint: 'unknown',
      outcome: 'partial',
      batches: 3,
    } as const
    events.externalHydrationTraversal(partial)

    const attributes = {
      xrpcEndpoint: 'unknown',
      root: 'uris',
      outcome: 'partial',
    }
    expect(otel.record.mock.calls).toEqual([
      ['hydration.external.record_lookups', 24, attributes],
      ['hydration.external.batches', 3, attributes],
      ['hydration.external.duration', 12.5, attributes],
    ])
    expect(otel.add.mock.calls.map(([, attrs]) => attrs.xrpcEndpoint)).toEqual([
      'unknown',
      'unknown',
      'unknown',
      'unknown',
    ])
    expect(otel.emit).toHaveBeenCalledWith({
      eventName: 'external_hydration_traversal',
      severityNumber: 9,
      attributes: partial,
    })
    expect(pino.info).toHaveBeenCalledWith({
      eventName: 'external_hydration_traversal',
      ...partial,
    })
  })

  it('never throws when a sink fails', () => {
    otel.record.mockImplementation(() => {
      throw new Error('histogram failure')
    })
    otel.emit.mockImplementation(() => {
      throw new Error('log failure')
    })

    expect(() => events.externalHydrationTraversal(summary)).not.toThrow()
    expect(() =>
      events.externalHydrationTraversal({ ...summary, outcome: 'partial' }),
    ).not.toThrow()
    // One log failure and one metrics failure per event: the metrics share a
    // single guard, so the counter is skipped after a histogram failure.
    expect(otel.diagError).toHaveBeenCalledTimes(4)
    expect(otel.add).not.toHaveBeenCalled()
  })

  it('never throws when the records counter fails', () => {
    otel.add.mockImplementation(() => {
      throw new Error('counter failure')
    })

    expect(() => events.externalHydrationTraversal(summary)).not.toThrow()
    expect(otel.record).toHaveBeenCalledTimes(3)
    expect(otel.diagError).toHaveBeenCalledOnce()
  })
})
