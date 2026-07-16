import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketConnectionEngine } from '../src/connection.js'
import { HeartbeatTimeoutError } from '../src/lib/errors.js'
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

  it('does not time out while paused for backpressure (pongs cannot arrive)', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: { intervalMs: 1000 },
      highWaterMark: 15, // 2 frames (20 bytes) crosses it
    })
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    // The first frame feeds the parked it.next(); the next two buffer.
    mock.emitMessage(new Uint8Array(10), true)
    mock.emitMessage(new Uint8Array(10), true) // buffered: 10
    mock.emitMessage(new Uint8Array(10), true) // buffered: 20 > 15 -> pause
    expect(mock.paused).toBe(true)

    // Well past 2x the interval with no pong: a paused socket delivers no
    // frames, so this must NOT be treated as a dead connection.
    vi.advanceTimersByTime(5000)
    expect(mock.terminated).toBe(false)

    // Drain below the low-water mark (7.5 bytes) to resume.
    await it.next() // buffered: 10
    await it.next() // buffered: 0 -> resume
    expect(mock.paused).toBe(false)

    // Detection works normally again after resume: a full window of silence
    // (ping tick, then no-evidence tick) times out.
    vi.advanceTimersByTime(1000) // ping, clear flag
    vi.advanceTimersByTime(1000) // no evidence -> terminate
    expect(mock.terminated).toBe(true)
    await expect(it.next()).rejects.toBeInstanceOf(HeartbeatTimeoutError)
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
