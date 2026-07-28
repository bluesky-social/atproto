import { assert, describe, expect, it, vi } from 'vitest'
import { CloseCode } from '../src/lib/close-codes.js'
import {
  BufferOverflowError,
  CloseError,
  IdleTimeoutError,
  SocketError,
  WebSocketConnectionError,
} from '../src/lib/errors.js'
import type { MessageOf } from '../src/message-channel.js'
import {
  type WebSocketCtor,
  createTransport,
} from '../src/transport/browser-transport.js'
import type { Sender, Transport } from '../src/transport/transport.js'
import { startServer } from './_util/server.js'

// Node 24 ships a global WHATWG `WebSocket`, so the real-socket tests below
// use it exactly as a browser would — no `undici` dependency needed. Cast
// through `unknown`: the ambient DOM/undici type is a structural superset of
// the minimal shape this transport declares for itself, but TypeScript's
// overloaded-method comparison doesn't see that automatically.
const globalWebSocket = globalThis.WebSocket as unknown as WebSocketCtor

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

// A minimal fake for the one branch a real socket can never reach: a message
// event whose `data` is neither a string nor an ArrayBuffer. Events are
// fired manually by the test rather than automatically from `close()`/
// `send()`, matching the real WHATWG API's async event dispatch (a script
// calling `close()` does not synchronously raise a 'close' event).
class FakeWebSocket {
  binaryType: 'blob' | 'arraybuffer' = 'blob'
  readonly closeCalls: Array<[number?, string?]> = []
  #listeners = new Map<string, Array<(ev: never) => void>>()

  constructor(
    readonly url: string | URL,
    readonly protocols?: string | string[],
  ) {}

  addEventListener(type: string, listener: (ev: never) => void): void {
    const list = this.#listeners.get(type) ?? []
    list.push(listener)
    this.#listeners.set(type, list)
  }

  send(_data: string | ArrayBufferLike | ArrayBufferView): void {}

  close(code?: number, reason?: string): void {
    this.closeCalls.push([code, reason])
  }

  emit(type: string, ev: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(ev as never)
    }
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
    // Omits the WebSocketCtor argument entirely, exercising the documented
    // default of `globalThis.WebSocket`.
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

  it('ends iteration with a CloseError carrying the code on a clean server close', async () => {
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Normal, 'bye')
    })
    const controller = new AbortController()
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {},
        onClose: () => {},
      },
      globalWebSocket,
    )
    const { error } = await drain(transport)
    assert(error instanceof CloseError)
    expect(error.code).toBe(CloseCode.Normal)
    expect(error.reason).toBe('bye')
    expect(error.wasClean).toBe(true)
    expect(error.shouldRetry()).toBe(false)
  })

  it('throws TypeError when a non-empty headers record is supplied', () => {
    const controller = new AbortController()
    expect(() =>
      createTransport(
        {
          url: 'ws://localhost:1',
          dataMode: 'auto',
          signal: controller.signal,
          headers: { Authorization: 'Bearer t0ken' },
          onOpen: () => {},
          onClose: () => {},
        },
        globalWebSocket,
      ),
    ).toThrow(TypeError)
  })

  it('throws TypeError when a non-empty Headers instance is supplied', () => {
    const controller = new AbortController()
    expect(() =>
      createTransport(
        {
          url: 'ws://localhost:1',
          dataMode: 'auto',
          signal: controller.signal,
          headers: new Headers({ Authorization: 'Bearer t0ken' }),
          onOpen: () => {},
          onClose: () => {},
        },
        globalWebSocket,
      ),
    ).toThrow(TypeError)
  })

  it('does not throw for an empty headers record or empty Headers instance', async () => {
    await using server = await startServer((ws) => ws.close(CloseCode.Normal))
    for (const headers of [{}, new Headers()]) {
      const controller = new AbortController()
      let transport!: Transport<'auto'>
      expect(() => {
        transport = createTransport(
          {
            url: server.url,
            dataMode: 'auto',
            signal: controller.signal,
            headers,
            onOpen: () => {},
            onClose: () => {},
          },
          globalWebSocket,
        )
      }).not.toThrow()
      await drain(transport)
    }
  })

  it('throws TypeError when no WebSocket implementation is available', () => {
    const controller = new AbortController()
    expect(() =>
      createTransport(
        {
          url: 'ws://localhost:1',
          dataMode: 'auto',
          signal: controller.signal,
          onOpen: () => {},
          onClose: () => {},
        },
        null as unknown as WebSocketCtor,
      ),
    ).toThrow(TypeError)
  })

  it('fails the channel with a SocketError on a malformed message data type', async () => {
    const instances: FakeWebSocket[] = []
    class CapturingWebSocket extends FakeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        instances.push(this)
      }
    }
    const onClose = vi.fn()
    const controller = new AbortController()
    const transport = createTransport(
      {
        url: 'ws://localhost:1',
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {},
        onClose,
      },
      CapturingWebSocket as unknown as WebSocketCtor,
    )
    assert(instances.length === 1)
    const [socket] = instances
    socket.emit('open', {})
    // Neither a string nor an ArrayBuffer — the one branch a real,
    // spec-compliant socket can never reach with binaryType 'arraybuffer'.
    socket.emit('message', { data: 42 })
    const { error } = await drain(transport)
    assert(error instanceof SocketError)
    expect(socket.closeCalls).toHaveLength(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith({
      code: CloseCode.Abnormal,
      reason: '',
      wasClean: false,
    })
  })

  it('resolves send() on hand-off once the socket is open', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        seen.push(data.toString())
        ws.close(CloseCode.Normal)
      })
    })
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: (s) => {
          sender = s
        },
        onClose: () => {},
      },
      globalWebSocket,
    )
    const drained = drain(transport)
    await vi.waitFor(() => assert(sender))
    // The server only closes after processing the message, so waiting for
    // the connection to end (not just send()'s own hand-off) is what proves
    // the message actually reached it.
    await sender.send('ping')
    await drained
    expect(seen).toEqual(['ping'])
  })

  it('rejects send() before the connection opens', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {},
        onClose: () => {},
      },
      globalWebSocket,
    )
    await expect(transport.send('too-soon')).rejects.toBeInstanceOf(
      WebSocketConnectionError,
    )
    controller.abort()
  })

  it('rejects send() after the connection closes', async () => {
    await using server = await startServer((ws) => ws.close(CloseCode.Normal))
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: (s) => {
          sender = s
        },
        onClose: () => {},
      },
      globalWebSocket,
    )
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
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen,
        onClose,
      },
      globalWebSocket,
    )
    await drain(transport)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    // Per the WHATWG spec, `wasClean` reflects whether the closing
    // handshake completed properly, not whether the code was 1000 — a
    // completed handshake with a non-Normal code is still "clean" in that
    // sense, unlike Node's own `ws` library which conflates the two.
    expect(onClose).toHaveBeenCalledWith({
      code: CloseCode.Policy,
      reason: 'nope',
      wasClean: true,
    })
  })

  it('ends iteration and closes the socket when signal aborts', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const onClose = vi.fn()
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {},
        onClose,
      },
      globalWebSocket,
    )
    const drained = drain(transport)
    await vi.waitFor(() => expect(onClose).not.toHaveBeenCalled())
    const reason = new Error('stop')
    controller.abort(reason)
    const { error } = await drained
    expect(error).toBe(reason)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fails with BufferOverflowError once buffered bytes exceed maxBufferedBytes', async () => {
    await using server = await startServer((ws) => {
      ws.on('message', (data) => {
        if (data.toString() === 'go') {
          // No read-side backpressure exists in the browser to slow this
          // down — every frame arrives regardless of consumption, so the
          // byte cap alone must catch an unbounded read buffer.
          for (let i = 0; i < 64; i++) ws.send('x'.repeat(4096))
        }
      })
    })
    const controller = new AbortController()
    const onClose = vi.fn()
    let sender!: Sender<'auto'>
    // Deliberately never drained before the burst: an unconsumed transport
    // is exactly the scenario the byte cap exists to catch. Iteration only
    // starts once `onClose` proves the channel has already reached its
    // terminal state — starting sooner would race a waiter into place, and
    // `push()` delivers straight to a parked waiter without ever consulting
    // the byte cap, which would flakily observe an ordinary message instead
    // of the overflow this test means to exercise.
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        maxBufferedBytes: 8192,
        onOpen: (s) => {
          sender = s
        },
        onClose,
      },
      globalWebSocket,
    )
    await vi.waitFor(() => assert(sender))
    await sender.send('go')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    const iterator = transport[Symbol.asyncIterator]()
    await expect(iterator.next()).rejects.toBeInstanceOf(BufferOverflowError)
  })

  it('fails with IdleTimeoutError when the connection is silent', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const transport = createTransport(
      {
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        idleTimeoutMs: 30,
        onOpen: () => {},
        onClose: () => {},
      },
      globalWebSocket,
    )
    const { error } = await drain(transport)
    assert(error instanceof IdleTimeoutError)
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
})
