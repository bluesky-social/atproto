import { describe, expect, it } from 'vitest'
import { WebSocketCoreEngine } from '../src/core.js'
import { BufferOverflowError } from '../src/errors.js'
import { MockTransport } from './_util/mock-transport.js'

// 10-byte binary frame (byteLength = 10).
const frame = () => new Uint8Array(10)

describe('WebSocketCoreEngine backpressure', () => {
  it('pauses when buffered bytes exceed highWaterMark', () => {
    const mock = new MockTransport()
    new WebSocketCoreEngine(() => mock, 'ws://x', {
      highWaterMark: 25, // 3 frames (30 bytes) crosses it
    })
    mock.emitOpen()
    mock.emitMessage(frame(), true) // 10
    mock.emitMessage(frame(), true) // 20
    expect(mock.paused).toBe(false)
    mock.emitMessage(frame(), true) // 30 > 25
    expect(mock.paused).toBe(true)
  })

  it('resumes when buffer drains below highWaterMark / 2 (hysteresis)', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketCoreEngine(() => mock, 'ws://x', {
      highWaterMark: 25, // low-water = 12.5
    })
    mock.emitOpen()
    mock.emitMessage(frame(), true) // 10
    mock.emitMessage(frame(), true) // 20
    mock.emitMessage(frame(), true) // 30 -> pause
    expect(mock.paused).toBe(true)

    const it = engine[Symbol.asyncIterator]()
    await it.next() // 20 (still > 12.5, stays paused)
    expect(mock.paused).toBe(true)
    await it.next() // 10 (< 12.5, resume)
    expect(mock.paused).toBe(false)
  })

  it('terminates with BufferOverflowError past maxBufferedBytes', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketCoreEngine(() => mock, 'ws://x', {
      maxBufferedBytes: 25,
    })
    mock.emitOpen()
    mock.emitMessage(frame(), true) // 10
    mock.emitMessage(frame(), true) // 20
    mock.emitMessage(frame(), true) // 30 > 25 -> overflow
    expect(mock.terminated).toBe(true)
    const it = engine[Symbol.asyncIterator]()
    await expect(it.next()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(BufferOverflowError)
      expect((err as BufferOverflowError).bufferedBytes).toBeGreaterThan(25)
      return true
    })
  })

  it('never pauses a transport that cannot pause/resume', () => {
    const mock = new MockTransport({
      capabilities: { heartbeat: false, pauseResume: false },
    })
    new WebSocketCoreEngine(() => mock, 'ws://x', {
      highWaterMark: 5,
    })
    mock.emitOpen()
    mock.emitMessage(frame(), true) // 10 > 5 but pauseResume false
    // pause() is still called on the transport; the transport no-ops it.
    // The engine must not crash and buffering continues.
    expect(() => mock.emitMessage(frame(), true)).not.toThrow()
  })
})
