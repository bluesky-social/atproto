import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { featureGatesLogger } from '../logger.js'
import { MetricsClient } from './metrics.js'

vi.mock('../logger', () => ({
  featureGatesLogger: {
    error: vi.fn(),
  },
}))

type TestEvents = {
  click: { button: string }
  view: { screen: string }
}

// Helper to flush promises and timers
const flushPromises = () => new Promise((r) => setImmediate(r))

describe('MetricsClient', () => {
  let fetchMock: Mock
  let fetchRequests: { body: any }[]
  let client: MetricsClient<TestEvents>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })
    fetchRequests = []
    fetchMock = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body)
      fetchRequests.push({ body })
      return { ok: true, status: 200, text: async () => '' }
    })
    global.fetch = fetchMock
  })

  afterEach(async () => {
    await client?.stop()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('flushes events on interval', async () => {
    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })
    await client.track('click', { button: 'submit' })
    await client.track('view', { screen: 'home' })

    expect(fetchRequests).toHaveLength(0)

    // Advance past the 10 second interval
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(fetchRequests).toHaveLength(1)
    expect(fetchRequests[0].body.events).toHaveLength(2)
    expect(fetchRequests[0].body.events[0].event).toBe('click')
    expect(fetchRequests[0].body.events[1].event).toBe('view')
  })

  it('flushes when maxBatchSize is exceeded', async () => {
    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })
    client.maxBatchSize = 5

    // Add events up to maxBatchSize (should not flush yet)
    for (let i = 0; i < 5; i++) {
      await client.track('click', { button: `btn-${i}` })
    }

    expect(fetchRequests).toHaveLength(0)

    // One more event should trigger flush (> maxBatchSize)
    await client.track('click', { button: 'btn-trigger' })
    await flushPromises()

    expect(fetchRequests).toHaveLength(1)
    expect(fetchRequests[0].body.events).toHaveLength(6)
  })

  it('logs error on failed request', async () => {
    fetchMock.mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }
    })

    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })
    await client.track('click', { button: 'submit' })

    // Trigger flush via interval
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(featureGatesLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
      }),
      'Failed to send metrics',
    )
  })

  it('handles fetch text() error gracefully', async () => {
    fetchMock.mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        text: async () => {
          throw new Error('Failed to read response')
        },
      }
    })

    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })
    await client.track('click', { button: 'submit' })

    // Trigger flush - should not throw
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(featureGatesLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: expect.stringContaining('Unknown error'),
        }),
      }),
      'Failed to send metrics',
    )
  })

  it('flushes when stop() is called', async () => {
    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })
    await client.track('click', { button: 'submit' })

    expect(fetchRequests).toHaveLength(0)

    // Stop should flush remaining events
    await client.stop()
    await flushPromises()

    expect(fetchRequests).toHaveLength(1)
    expect(fetchRequests[0].body.events).toHaveLength(1)
    expect(fetchRequests[0].body.events[0].event).toBe('click')
  })

  it('does not send if trackingEndpoint is not configured', async () => {
    client = new MetricsClient<TestEvents>({})
    await client.track('click', { button: 'submit' })

    // Trigger flush via interval
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('start() is idempotent', async () => {
    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })

    // track() calls start() internally
    await client.track('click', { button: 'submit' })
    client.start()
    client.start()

    // Advance past interval - should only flush once
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(fetchRequests).toHaveLength(1)
  })

  it('does not flush if queue is empty', async () => {
    client = new MetricsClient<TestEvents>({
      trackingEndpoint: 'https://test.metrics.api',
    })
    client.start()

    // Advance past interval with empty queue
    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
