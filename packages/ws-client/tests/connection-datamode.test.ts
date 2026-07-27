import { assert, describe, expect, it } from 'vitest'
import { WebSocketConnectionEngine } from '../src/connection.js'
import { DataModeError } from '../src/lib/errors.js'
import { MockTransport } from './_util/mock-transport.js'

describe('WebSocketConnectionEngine dataMode', () => {
  it('auto yields both text and binary', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(mock.factory, 'ws://x', {
      dataMode: 'auto',
    })
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    mock.emitMessage('t')
    expect((await it.next()).value).toBe('t')
    const bin = new Uint8Array([1])
    mock.emitMessage(bin)
    expect((await it.next()).value).toBe(bin)
  })

  it('text mode rejects a binary frame with DataModeError', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(mock.factory, 'ws://x', {
      dataMode: 'text',
    })
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    mock.emitMessage(new Uint8Array([1])) // binary -> violation
    expect(mock.closedWith).toEqual({ code: 1003, reason: undefined })
    expect(mock.terminated).toBe(true)
    await expect(it.next()).rejects.toSatisfy((err) => {
      assert(err instanceof DataModeError)
      expect(err.expected).toBe('text')
      expect(err.received).toBe('binary')
      return true
    })
  })

  it('binary mode rejects a text frame with DataModeError', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(mock.factory, 'ws://x', {
      dataMode: 'binary',
    })
    mock.emitOpen()
    const it = engine[Symbol.asyncIterator]()
    mock.emitMessage('oops') // text -> violation
    await expect(it.next()).rejects.toSatisfy((err) => {
      assert(err instanceof DataModeError)
      expect(err.expected).toBe('binary')
      expect(err.received).toBe('text')
      return true
    })
  })

  it('enforces even while the consumer is behind (fail-fast at intake)', async () => {
    const mock = new MockTransport()
    const engine = new WebSocketConnectionEngine(mock.factory, 'ws://x', {
      dataMode: 'text',
    })
    // Acquire the iterator before driving terminal events (a never-iterated
    // engine that is already terminal throws on iteration, by design).
    const it = engine[Symbol.asyncIterator]()
    mock.emitOpen()
    // Buffer valid text with no consumer, then a binary violation arrives.
    mock.emitMessage('a')
    mock.emitMessage(new Uint8Array([1])) // violation while behind
    // Buffered valid message is discarded by the failure transition.
    await expect(it.next()).rejects.toBeInstanceOf(DataModeError)
  })
})
