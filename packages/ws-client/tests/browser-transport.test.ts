import { assert, describe, expect, it, vi } from 'vitest'
import { CloseCode } from '../src/lib/close-codes.js'
import {
  BufferOverflowError,
  CloseError,
  IdleTimeoutError,
  SocketError,
  WebSocketClientError,
} from '../src/lib/errors.js'
import type { CloseEventDetail, MessageOf } from '../src/message-channel.js'
import {
  type WebSocketCtor,
  createTransport,
} from '../src/transport/browser-transport.js'
import type { Sender, Transport } from '../src/transport/transport.js'
import { startServer } from './_util/server.js'
import { transportOptionDefaults } from './_util/transport-options.js'

// Node 24 ships a global WHATWG `WebSocket`, so the real-socket tests below use
// it exactly as a browser would, with no `undici` dependency. Cast through
// `unknown` because the ambient DOM/undici type is a structural superset of the
// minimal shape this transport declares, which TypeScript's overloaded-method
// comparison doesn't see on its own.
const globalWebSocket = globalThis.WebSocket as unknown as WebSocketCtor

// Drains a transport's iteration into an array, returning rather than throwing
// whatever terminal error it surfaces.
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
// event whose `data` is neither a string nor an ArrayBuffer. The test fires
// events manually rather than having `close()`/`send()` do it, matching the real
// API — a script calling `close()` doesn't synchronously raise a 'close' event.
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

  // Records the call, then fires 'close' on a later tick like a real socket: the
  // event is always asynchronous, and it always comes. The transport's contract
  // depends on the second part — iteration settles from the close event — so a
  // fake that swallowed it would hang rather than fail.
  close(code?: number, reason?: string): void {
    if (this.closeCalls.length) return // first close wins, as in the real API
    this.closeCalls.push([code, reason])
    setTimeout(() => {
      this.emit('close', {
        code: code ?? CloseCode.NoStatus,
        reason: reason ?? '',
        wasClean: code === CloseCode.Normal,
      })
    }, 0)
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
    // No WebSocketCtor argument, exercising the documented default of
    // `globalThis.WebSocket`.
    const transport = createTransport({
      ...transportOptionDefaults,
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
    // A clean close completes the iteration; the code is reported via onClose.
    expect(error).toBeUndefined()
  })

  it('completes iteration and reports the detail on a clean server close', async () => {
    // A transport signals an orderly close by completing, per the ordinary
    // iterator contract, and reports the detail through onClose. It doesn't
    // invent an error for something that isn't one; the reconnect loop builds a
    // classifiable CloseError from that detail itself.
    await using server = await startServer((ws) => {
      ws.close(CloseCode.Normal, 'bye')
    })
    const controller = new AbortController()
    const closes: CloseEventDetail[] = []
    const transport = createTransport(
      {
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {},
        onClose: (detail) => closes.push(detail),
      },
      globalWebSocket,
    )
    const { error } = await drain(transport)
    expect(error).toBeUndefined()
    expect(closes).toEqual([
      { code: CloseCode.Normal, reason: 'bye', wasClean: true },
    ])
  })

  it('throws TypeError when a non-empty headers record is supplied', () => {
    const controller = new AbortController()
    expect(() =>
      createTransport(
        {
          ...transportOptionDefaults,
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
          ...transportOptionDefaults,
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
            ...transportOptionDefaults,
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
          ...transportOptionDefaults,
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

  it('settles iteration when the socket is aborted before it opens', async () => {
    // Aborting before the handshake completes means calling close() on a
    // CONNECTING socket, and what happens then is platform-dependent: Node 24
    // raises 'error' *and* 'close', while Node 22 raises 'error' twice and never
    // closes at all, leaving the socket stuck in CLOSING. Iteration waits for the
    // close event to prove teardown finished, so on Node 22 that wait would
    // otherwise never end.
    //
    // Driven through a real socket rather than a fake, since the whole point is
    // what the platform actually does. Both versions must settle the iteration.
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const onClose = vi.fn()
    const transport = createTransport(
      {
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onClose,
      },
      globalWebSocket,
    )
    const drained = drain(transport)
    // No wait for 'open': the abort races the handshake and usually wins.
    const reason = new Error('stop')
    controller.abort(reason)
    const { error } = await drained
    expect(error).toBe(reason)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('substitutes 1000 for close codes the platform rejects', async () => {
    // `WebSocket.close()` accepts only 1000 and the private-use range 3000-4999;
    // every other value throws InvalidAccessError synchronously. A dataMode
    // violation asks the channel to close with 1003, so passing that through would
    // throw from inside the message handler, where nothing can catch it — taking
    // the process down rather than ending the connection.
    await using server = await startServer((ws) => {
      // Binary under dataMode 'text': the channel fails and asks for 1003.
      ws.send(Buffer.from([1, 2, 3]))
    })
    const controller = new AbortController()
    const transport = createTransport(
      {
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'text',
        signal: controller.signal,
      },
      globalWebSocket,
    )
    const { error } = await drain(transport)
    expect((error as Error).name).toBe('DataModeError')
  })

  it('passes a private-use close code through unchanged', async () => {
    // 3000-4999 is the range the spec leaves to applications, so a caller's
    // CloseError in that range reaches the peer as-is.
    let serverSaw: number | undefined
    let resolveClosed!: () => void
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve
    })
    await using server = await startServer((ws) => {
      ws.on('close', (code) => {
        serverSaw = code
        resolveClosed()
      })
    })
    const controller = new AbortController()
    let opened = false
    const transport = createTransport(
      {
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {
          opened = true
        },
      },
      globalWebSocket,
    )
    const drained = drain(transport)
    await vi.waitFor(() => assert(opened))
    controller.abort(new CloseError(4001, 'app-specific', false))
    await drained
    await closed
    expect(serverSaw).toBe(4001)
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
        ...transportOptionDefaults,
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
    // Neither a string nor an ArrayBuffer: the one branch a spec-compliant
    // socket can never reach with binaryType 'arraybuffer'.
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
        ...transportOptionDefaults,
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
    // The server only closes after processing the message, so waiting for the
    // connection to end — not just send()'s own hand-off — is what proves the
    // message actually reached it.
    await sender.send('ping')
    await drained
    expect(seen).toEqual(['ping'])
  })

  it('rejects send() before the connection opens', async () => {
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const transport = createTransport(
      {
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {},
        onClose: () => {},
      },
      globalWebSocket,
    )
    await expect(transport.send('too-soon')).rejects.toBeInstanceOf(
      WebSocketClientError,
    )
    controller.abort()
  })

  it('rejects send() after the connection closes', async () => {
    await using server = await startServer((ws) => ws.close(CloseCode.Normal))
    const controller = new AbortController()
    let sender!: Sender<'auto'>
    const transport = createTransport(
      {
        ...transportOptionDefaults,
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
      WebSocketClientError,
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
        ...transportOptionDefaults,
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
    // Per the WHATWG spec, `wasClean` reflects whether the closing handshake
    // completed, not whether the code was 1000: a completed handshake with a
    // non-Normal code is still clean. Node's `ws` conflates the two.
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
    let opened = false
    const transport = createTransport(
      {
        ...transportOptionDefaults,
        url: server.url,
        dataMode: 'auto',
        signal: controller.signal,
        onOpen: () => {
          opened = true
        },
        onClose,
      },
      globalWebSocket,
    )
    const drained = drain(transport)
    // Wait for a real open: asserting `onClose` has *not* fired passes on the
    // first tick and waits for nothing, which would leave the abort racing the
    // handshake — a different path, covered separately above.
    await vi.waitFor(() => assert(opened))
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
          // The browser has no read-side backpressure to slow this down: every
          // frame arrives regardless of consumption, so the byte cap alone has
          // to catch an unbounded read buffer.
          for (let i = 0; i < 64; i++) ws.send('x'.repeat(4096))
        }
      })
    })
    const controller = new AbortController()
    const onClose = vi.fn()
    let sender!: Sender<'auto'>
    // Never drained before the burst: an unconsumed transport is exactly the
    // scenario the byte cap exists to catch. Iteration starts only once `onClose`
    // proves the channel is already terminal — starting sooner would race a
    // waiter into place, and `push()` delivers straight to a parked waiter
    // without consulting the byte cap, so the test would flakily see an ordinary
    // message instead of the overflow.
    const transport = createTransport(
      {
        ...transportOptionDefaults,
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
        ...transportOptionDefaults,
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
      ...transportOptionDefaults,
      url: server.url,
      dataMode: 'text',
      signal: ac.signal,
      onOpen: () => {},
      onClose: () => {},
    })
    const iterator = transport[Symbol.asyncIterator]()
    expect(await iterator.next()).toEqual({ value: 'one', done: false })
    // A consumer stop is not the connection ending, so neither the return() nor
    // any later pull may surface an error. A pull after the stop used to
    // synthesize a *retryable* error, making a deliberate stop look like
    // transient trouble to the reconnect policy — whose `yield*` can pull again
    // after a downstream return() propagates.
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
