import { assert, describe, expect, it, vi } from 'vitest'
import type { WebSocket as WsSocket } from 'ws'
import { CloseCode } from '../src/lib/close-codes.js'
import {
  CloseError,
  HeartbeatTimeoutError,
  WebSocketConnectionError,
} from '../src/lib/errors.js'
import type { MessageOf } from '../src/message-channel.js'
import { createTransport } from '../src/transport/node-transport.js'
import type { Sender, Transport } from '../src/transport/transport.js'
import { startServer } from './_util/server.js'

// Drains a transport's iteration into an array, tolerating (and returning)
// the terminal error every transport surfaces — including a clean close.
async function drain<M extends 'auto' | 'text' | 'binary'>(
  transport: Transport<M>,
): Promise<{ messages: MessageOf<M>[]; error: unknown }> {
  const messages: MessageOf<M>[] = []
  try {
    for await (const message of transport) {
      messages.push(message)
    }
    return { messages, error: undefined }
  } catch (error) {
    return { messages, error }
  }
}

describe(createTransport, () => {
  it('round-trips text and binary frames through iteration', async () => {
    await using server = await startServer((ws) => {
      ws.send('hello')
      ws.send(Buffer.from([1, 2, 3]))
      ws.close(CloseCode.Normal)
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const { messages, error } = await drain(transport)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toBe('hello')
    assert(messages[1] instanceof Uint8Array)
    expect(Array.from(messages[1])).toEqual([1, 2, 3])
    assert(error instanceof CloseError)
    expect(error.code).toBe(CloseCode.Normal)
  })

  it('honors dataMode typing by failing on a mismatched frame', async () => {
    await using server = await startServer((ws) => {
      ws.send(Buffer.from([9, 9, 9]))
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'text',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    await expect(iterator.next()).rejects.toSatisfy((err: unknown) => {
      // DataModeError, surfaced from the channel.
      expect((err as Error).name).toBe('DataModeError')
      return true
    })
    controller.abort()
  })

  it('delivers headers from a plain record to the server upgrade request', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(CloseCode.Normal)
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      headers: { Authorization: 'Bearer t0ken' },
      onOpen: () => {},
      onClose: () => {},
    })
    await drain(transport)
    expect(seenAuth).toBe('Bearer t0ken')
  })

  it('delivers headers from a WHATWG Headers instance', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(CloseCode.Normal)
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      headers: new Headers({ Authorization: 'Bearer hdr' }),
      onOpen: () => {},
      onClose: () => {},
    })
    await drain(transport)
    expect(seenAuth).toBe('Bearer hdr')
  })

  it('ends iteration with a CloseError carrying the code on a clean server close', async () => {
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Normal, 'bye')
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const { error } = await drain(transport)
    assert(error instanceof CloseError)
    expect(error.code).toBe(CloseCode.Normal)
    expect(error.reason).toBe('bye')
    expect(error.wasClean).toBe(true)
    expect(error.shouldRetry()).toBe(false)
  })

  it('surfaces a retryable error when the server drops the connection abruptly', async () => {
    await using server = await startServer((ws) => {
      // @ts-expect-error accessing the underlying socket to force an abrupt drop
      ws._socket.destroy()
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const { error } = await drain(transport)
    assert(error instanceof WebSocketConnectionError)
    expect(error.shouldRetry()).toBe(true)
  })

  it('resolves send() once the message is flushed to the server', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        seen.push(data.toString())
        ws.close(CloseCode.Normal)
      })
    })
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: (s) => {
        sender = s
      },
      onClose: () => {},
    })
    const drained = drain(transport)
    await vi.waitFor(() => assert(sender))
    // The server only closes after processing the message, so waiting for
    // the connection to end (not just send()'s own flush) is what proves the
    // message actually reached it.
    await sender.send('ping')
    await drained
    expect(seen).toEqual(['ping'])
  })

  it('rejects send() before the connection opens', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    await expect(transport.send('too-soon')).rejects.toBeInstanceOf(
      WebSocketConnectionError,
    )
    controller.abort()
  })

  it('rejects send() after the connection closes', async () => {
    await using server = await startServer((ws) => ws.close(CloseCode.Normal))
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: (s) => {
        sender = s
      },
      onClose: () => {},
    })
    await drain(transport)
    await expect(sender.send('too-late')).rejects.toBeInstanceOf(
      WebSocketConnectionError,
    )
  })

  it('fires onOpen and onClose each exactly once with correct detail', async () => {
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Policy, 'nope')
    })
    const controller = new AbortController()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen,
      onClose,
    })
    await drain(transport)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith({
      code: CloseCode.Policy,
      reason: 'nope',
      wasClean: false,
    })
  })

  it('ends iteration and closes the socket when signal aborts', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const onClose = vi.fn()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      onOpen: () => {},
      onClose,
    })
    const drained = drain(transport)
    await vi.waitFor(() => expect(onClose).not.toHaveBeenCalled())
    const reason = new Error('stop')
    controller.abort(reason)
    const { error } = await drained
    expect(error).toBe(reason)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies real backpressure: a slow consumer pauses a fast server', async () => {
    let serverWs: WsSocket | undefined
    let interval: ReturnType<typeof setInterval> | undefined
    await using server = await startServer((ws) => {
      serverWs = ws
      ws.on('message', (data) => {
        if (data.toString() === 'go') {
          // Blast far more data than the client's watermark permits. Once
          // the transport pauses its socket, the client stops draining its
          // kernel receive buffer, TCP flow control kicks in, and the
          // server's own send buffer — `ws.bufferedAmount`, filled by
          // `ws.send()` faster than the OS can flush it onto a blocked
          // connection — climbs and stays high. That's the observable proxy
          // for real backpressure, without reaching into the client's
          // transport internals.
          interval = setInterval(() => ws.send('x'.repeat(65536)), 0)
        }
      })
    })
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    // Deliberately never iterated: an unconsumed transport is exactly the
    // slow-consumer scenario under test, so only `send()` is exercised here.
    createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      highWaterMark: 1024,
      onOpen: (s) => {
        sender = s
      },
      onClose: () => {},
    })
    await vi.waitFor(() => assert(sender))
    await sender.send('go')
    await vi.waitFor(
      () => {
        assert(serverWs)
        expect(serverWs.bufferedAmount).toBeGreaterThan(1_000_000)
      },
      { timeout: 5000, interval: 20 },
    )
    clearInterval(interval)
    controller.abort()
  })

  it('keeps an idle connection alive via heartbeat against a real server', async () => {
    // `ws` answers protocol pings automatically (autoPong defaults to true),
    // so a server that never sends anything still keeps the heartbeat happy.
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const onClose = vi.fn()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      heartbeat: { intervalMs: 30 },
      onOpen: () => {},
      onClose,
    })
    const iterator = transport[Symbol.asyncIterator]()
    const pending = iterator.next()
    // Outlive several heartbeat intervals without the channel failing.
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(onClose).not.toHaveBeenCalled()
    controller.abort()
    await pending.catch(() => {})
  })

  it('fails with HeartbeatTimeoutError when the server stops answering pings', async () => {
    await using server = await startServer((ws) => {
      // Disable the automatic pong response so pings go unanswered.
      // @ts-expect-error reaching into ws internals to disable autoPong
      ws._autoPong = false
    })
    const controller = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'auto',
      signal: controller.signal,
      heartbeat: { intervalMs: 20 },
      onOpen: () => {},
      onClose: () => {},
    })
    const { error } = await drain(transport)
    assert(error instanceof HeartbeatTimeoutError)
    expect(error.shouldRetry()).toBe(true)
  })

  it('completes rather than erroring on a pull after the consumer stops', async () => {
    await using server = await startServer((ws) => {
      ws.send('one')
      ws.send('two')
    })
    const ac = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: 'one', done: false })
    // A consumer stop is not the connection ending: neither the return() nor
    // any later pull may surface an error. A pull after the stop used to
    // synthesize a *retryable* error, which would make a deliberate stop look
    // like transient trouble to the reconnect policy above — `yield*` in that
    // layer can pull again after a downstream return() propagates.
    await expect(iterator.return!()).resolves.toEqual({
      value: undefined,
      done: true,
    })
    await expect(iterator.next()).resolves.toEqual({
      value: undefined,
      done: true,
    })
    ac.abort(new Error('test cleanup'))
  })

  it('rejects a parked pull with the abort reason', async () => {
    // The reconnect loop depends on this: a `yield*` parked on a pull cannot
    // observe an abort by itself, so the transport must reject the pull rather
    // than leave it hanging.
    await using server = await startServer(() => {
      // Never sends, so the consumer's pull parks.
    })
    const ac = new AbortController()
    const transport = createTransport({
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    const pull = iterator.next()
    const reason = new Error('stopped')
    ac.abort(reason)
    await expect(pull).rejects.toBe(reason)
  })
})
