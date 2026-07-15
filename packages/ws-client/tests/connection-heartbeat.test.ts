import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketConnectionEngine } from '../src/connection.js'
import { HeartbeatTimeoutError } from '../src/errors.js'
import { MockTransport } from './_util/mock-transport.js'

describe('WebSocketConnectionEngine heartbeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pings after each interval when alive', () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    // Lazy open: begin iterating so the transport opens.
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    vi.advanceTimersByTime(1000)
    expect(mock.pinged).toBe(1)
    mock.emitPong() // liveness
    vi.advanceTimersByTime(1000)
    expect(mock.pinged).toBe(2)
  })

  it('a busy but pongless connection survives (message = liveness)', () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    // Lazy open: begin iterating so the transport opens.
    const it = engine[Symbol.asyncIterator]()
    void it.next()
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
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next() // begin iterating so the transport opens
    mock.emitOpen()
    vi.advanceTimersByTime(1000) // ping, clear flag
    vi.advanceTimersByTime(1000) // no evidence -> terminate
    expect(mock.terminated).toBe(true)
    await expect(pending).rejects.toBeInstanceOf(HeartbeatTimeoutError)
  })

  it('is never scheduled without capabilities.heartbeat', () => {
    const mock = new MockTransport({
      capabilities: { heartbeat: false, pauseResume: true },
    })
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
    })
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    vi.advanceTimersByTime(5000)
    expect(mock.pinged).toBe(0)
    expect(mock.terminated).toBe(false)
  })

  it('is disabled by heartbeat: false', () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: false,
    })
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    vi.advanceTimersByTime(5000)
    expect(mock.pinged).toBe(0)
  })
})
