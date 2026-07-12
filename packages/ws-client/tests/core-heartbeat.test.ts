import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketCoreEngine } from '../src/core.js'
import { HeartbeatTimeoutError } from '../src/errors.js'
import { MockTransport } from './_util/mock-transport.js'

describe('WebSocketCoreEngine heartbeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pings after each interval when alive', () => {
    const mock = new MockTransport()
    new WebSocketCoreEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    mock.emitOpen()
    vi.advanceTimersByTime(1000)
    expect(mock.pinged).toBe(1)
    mock.emitPong() // liveness
    vi.advanceTimersByTime(1000)
    expect(mock.pinged).toBe(2)
  })

  it('a busy but pongless connection survives (message = liveness)', () => {
    const mock = new MockTransport()
    new WebSocketCoreEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    mock.emitOpen()
    // Never send a pong; only data frames.
    for (let i = 0; i < 5; i++) {
      mock.emitMessage('busy', false)
      vi.advanceTimersByTime(1000)
    }
    expect(mock.terminated).toBe(false)
  })

  it('detects a dead connection within 2x interval', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketCoreEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    vi.advanceTimersByTime(1000) // ping, clear flag
    vi.advanceTimersByTime(1000) // no evidence -> terminate
    expect(mock.terminated).toBe(true)
    await expect(it.next()).rejects.toBeInstanceOf(HeartbeatTimeoutError)
  })

  it('is never scheduled without capabilities.heartbeat', () => {
    const mock = new MockTransport({
      capabilities: { heartbeat: false, pauseResume: true },
    })
    new WebSocketCoreEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    mock.emitOpen()
    vi.advanceTimersByTime(5000)
    expect(mock.pinged).toBe(0)
    expect(mock.terminated).toBe(false)
  })

  it('is disabled by heartbeat: false', () => {
    const mock = new MockTransport()
    new WebSocketCoreEngine(() => mock, 'ws://x', { heartbeat: false })
    mock.emitOpen()
    vi.advanceTimersByTime(5000)
    expect(mock.pinged).toBe(0)
  })
})
