import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketConnectionEngine } from '../src/connection.js'
import { IdleTimeoutError } from '../src/lib/errors.js'
import { MockTransport } from './_util/mock-transport.js'

describe('WebSocketConnectionEngine idle timeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is off by default', () => {
    const mock = new MockTransport()
    // heartbeat: false isolates this test to idle-timeout behavior only —
    // MockTransport defaults capabilities.heartbeat to true, so without this
    // the default 10s heartbeat would terminate the connection on its own.
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      heartbeat: false,
    })
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    vi.advanceTimersByTime(60_000)
    expect(mock.terminated).toBe(false)
  })

  it('terminates when no message arrives within 2x window', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      idleTimeoutMs: 1000,
      heartbeat: false,
    })
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next() // begin iterating so the transport opens
    mock.emitOpen()
    vi.advanceTimersByTime(1000) // clear flag
    vi.advanceTimersByTime(1000) // no message -> terminate
    expect(mock.terminated).toBe(true)
    await expect(pending).rejects.toBeInstanceOf(IdleTimeoutError)
  })

  it('a steady message stream keeps it alive', () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      idleTimeoutMs: 1000,
      heartbeat: false,
    })
    const it = engine[Symbol.asyncIterator]()
    void it.next()
    mock.emitOpen()
    for (let i = 0; i < 5; i++) {
      mock.emitMessage('data', false)
      vi.advanceTimersByTime(1000)
    }
    expect(mock.terminated).toBe(false)
  })

  it('pongs do NOT reset the idle timer', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(() => mock, 'ws://x', {
      idleTimeoutMs: 1000,
      heartbeat: false,
    })
    const it = engine[Symbol.asyncIterator]()
    const pending = it.next() // begin iterating so the transport opens
    mock.emitOpen()
    mock.emitPong()
    vi.advanceTimersByTime(1000) // clear flag (pong didn't set it)
    mock.emitPong()
    vi.advanceTimersByTime(1000) // still no message -> terminate
    expect(mock.terminated).toBe(true)
    await expect(pending).rejects.toBeInstanceOf(IdleTimeoutError)
  })
})
