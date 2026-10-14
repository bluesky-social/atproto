import { Code, ConnectError } from '@connectrpc/connect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { events } from './events.js'

const otel = vi.hoisted(() => ({
  add: vi.fn(),
  emit: vi.fn(),
  record: vi.fn<(name: string, value: number, attributes: object) => void>(),
  diagError: vi.fn(),
}))

vi.mock('@opentelemetry/api', () => ({
  ValueType: { INT: 1 },
  diag: { error: otel.diagError },
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

vi.mock('@opentelemetry/api-logs', () => ({
  SeverityNumber: { INFO: 9 },
  logs: { getLogger: () => ({ emit: otel.emit }) },
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
    root: 'uris',
    outcome: 'capped',
    recordLookups: 24,
    batches: 8,
    maxPass: 8,
  } as const

  it('records totals with bounded attributes and logs the summary', () => {
    events.externalHydrationTraversal(summary)

    const attributes = { root: 'uris', outcome: 'capped' }
    expect(otel.record.mock.calls).toEqual([
      ['hydration.external.record_lookups', 24, attributes],
      ['hydration.external.batches', 8, attributes],
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

  it('never throws when a sink fails', () => {
    otel.record.mockImplementation(() => {
      throw new Error('histogram failure')
    })
    otel.emit.mockImplementation(() => {
      throw new Error('log failure')
    })

    expect(() => events.externalHydrationTraversal(summary)).not.toThrow()
    expect(otel.diagError).toHaveBeenCalledTimes(2)
  })
})
