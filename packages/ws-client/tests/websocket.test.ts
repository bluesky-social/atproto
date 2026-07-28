import { assert, describe, expect, it, vi } from 'vitest'
import { CloseCode } from '../src/lib/close-codes.js'
import { CloseError, SocketError } from '../src/lib/errors.js'
import type { CloseEventDetail } from '../src/message-channel.js'
import type { Transport, TransportFactory } from '../src/transport/transport.js'
import { createWebSocket } from '../src/websocket.js'

// One entry per connection the loop will make. Transports surface every
// connection end as a throw (a clean close included, as a CloseError carrying
// its code), so both scripted outcomes throw.
type Step =
  | { messages: string[]; end: 'clean'; detail?: CloseEventDetail }
  | { messages: string[]; end: 'error'; error: unknown }

function scripted(steps: Step[]) {
  const urls: string[] = []
  const signals: AbortSignal[] = []
  let index = 0
  const createTransport = ((options) => {
    urls.push(String(options.url))
    signals.push(options.signal)
    const step = steps[index++]
    assert(step, 'scripted transport: script exhausted')
    // A scripted connection is one that opened; report it as a real transport
    // would so the loop fires onOpen/onReconnect and resets its backoff.
    queueMicrotask(() => options.onOpen(transport))
    const transport: Transport<'auto'> = {
      async send() {},
      async *[Symbol.asyncIterator]() {
        for (const m of step.messages) yield m
        if (step.end === 'error') {
          options.onClose({ code: 1006, reason: '', wasClean: false })
          throw step.error
        }
        const detail = step.detail ?? {
          code: CloseCode.Normal,
          reason: '',
          wasClean: true,
        }
        options.onClose(detail)
        throw new CloseError(detail.code, detail.reason, detail.wasClean)
      },
    }
    return transport
  }) as TransportFactory
  return { createTransport, urls, signals }
}

// A transport that opens and then never ends on its own, recording whether its
// teardown signal fired — the only way the loop can end a live connection.
//
// Faithful to the real transports on one point that matters here: aborting the
// signal rejects a parked pull (they route it through the message channel's
// `fail()`). The loop depends on that contract — a `yield*` parked on a pull
// cannot observe an abort by itself, so a transport that ignored its signal
// would hang the stream.
function parkingTransport() {
  let tornDown = false
  const createTransport = ((options) => {
    let rejectPull: ((reason: unknown) => void) | undefined
    options.signal.addEventListener('abort', () => {
      tornDown = true
      rejectPull?.(options.signal.reason)
    })
    queueMicrotask(() => options.onOpen(transport))
    const transport: Transport<'auto'> = {
      async send() {},
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise<never>((_resolve, reject) => {
            rejectPull = reject
          }),
        return: async () => ({ value: undefined, done: true as const }),
      }),
    }
    return transport
  }) as TransportFactory
  return { createTransport, wasTornDown: () => tornDown }
}

// maxReconnectSeconds: 0 caps the backoff at 0ms, so reconnect tests don't wait.
const noBackoff = { maxReconnectSeconds: 0 }

async function drain(
  gen: AsyncGenerator<unknown, void, undefined>,
): Promise<unknown[]> {
  const out: unknown[] = []
  for await (const m of gen) out.push(m)
  return out
}

describe(createWebSocket, () => {
  it('yields messages then ends on a fatal clean close', async () => {
    const { createTransport } = scripted([
      { messages: ['a', 'b'], end: 'clean' },
    ])
    const websocket = createWebSocket(createTransport)
    // A server-sent 1000 is fatal under the default policy: the stream ends
    // rather than rejecting.
    expect(await drain(websocket('ws://x', noBackoff))).toEqual(['a', 'b'])
  })

  it('spans reconnects transparently', async () => {
    const { createTransport } = scripted([
      { messages: ['a'], end: 'error', error: new SocketError(new Error('x')) },
      { messages: ['b'], end: 'clean' },
    ])
    const websocket = createWebSocket(createTransport)
    expect(await drain(websocket('ws://x', noBackoff))).toEqual(['a', 'b'])
  })

  it('re-invokes a url function on every attempt', async () => {
    const { createTransport, urls } = scripted([
      { messages: [], end: 'error', error: new SocketError(new Error('x')) },
      { messages: [], end: 'clean' },
    ])
    const websocket = createWebSocket(createTransport)
    let n = 0
    await drain(websocket(() => `ws://x/${n++}`, noBackoff))
    expect(urls).toEqual(['ws://x/0', 'ws://x/1'])
  })

  it('awaits an async url function', async () => {
    const { createTransport, urls } = scripted([{ messages: [], end: 'clean' }])
    const websocket = createWebSocket(createTransport)
    await drain(websocket(async () => 'ws://async', noBackoff))
    expect(urls).toEqual(['ws://async'])
  })

  it('tears each connection down when it ends', async () => {
    const { createTransport, signals } = scripted([
      { messages: [], end: 'error', error: new SocketError(new Error('x')) },
      { messages: [], end: 'clean' },
    ])
    const websocket = createWebSocket(createTransport)
    await drain(websocket('ws://x', noBackoff))
    // A transport has no close method: its signal is the only teardown, so
    // every connection's must be aborted or the socket leaks.
    expect(signals).toHaveLength(2)
    expect(signals.every((s) => s.aborted)).toBe(true)
  })

  describe('reconnect policy', () => {
    it('reconnects on 1001 and stops on 1000 by default', async () => {
      const { createTransport } = scripted([
        {
          messages: ['a'],
          end: 'clean',
          detail: {
            code: CloseCode.GoingAway,
            reason: 'restart',
            wasClean: true,
          },
        },
        { messages: ['b'], end: 'clean' }, // 1000: fatal
      ])
      const websocket = createWebSocket(createTransport)
      expect(await drain(websocket('ws://x', noBackoff))).toEqual(['a', 'b'])
    })

    it('rethrows a fatal error, reporting it with no reconnect', async () => {
      const fatal = new CloseError(CloseCode.ProtocolError, 'protocol', false)
      const { createTransport } = scripted([
        { messages: [], end: 'error', error: fatal },
      ])
      const onError = vi.fn()
      const websocket = createWebSocket(createTransport)
      await expect(
        drain(websocket('ws://x', { ...noBackoff, onError })),
      ).rejects.toBe(fatal)
      expect(onError).toHaveBeenCalledWith(fatal, undefined)
    })

    it('reports a retryable error with its attempt number', async () => {
      const retryable = new SocketError(new Error('x'))
      const { createTransport } = scripted([
        { messages: [], end: 'error', error: retryable },
        { messages: [], end: 'clean' },
      ])
      const onError = vi.fn()
      const websocket = createWebSocket(createTransport)
      await drain(websocket('ws://x', { ...noBackoff, onError }))
      expect(onError).toHaveBeenCalledWith(retryable, { attempt: 0 })
    })

    it('makes every failure fatal when shouldReconnect is false', async () => {
      const retryable = new SocketError(new Error('x'))
      const { createTransport } = scripted([
        { messages: [], end: 'error', error: retryable },
      ])
      const websocket = createWebSocket(createTransport)
      await expect(
        drain(websocket('ws://x', { shouldReconnect: false })),
      ).rejects.toBe(retryable)
    })

    it('lets a custom policy replace the default classification', async () => {
      const { createTransport } = scripted([
        { messages: ['a'], end: 'clean' }, // 1000: the default would stop here
        {
          messages: ['b'],
          end: 'clean',
          detail: {
            code: CloseCode.ProtocolError,
            reason: '',
            wasClean: false,
          },
        },
      ])
      const attempts: number[] = []
      const websocket = createWebSocket(createTransport)
      const gen = websocket('ws://x', {
        ...noBackoff,
        shouldReconnect: (error, attempt) => {
          attempts.push(attempt)
          return error instanceof CloseError && error.code === CloseCode.Normal
        },
      })
      await expect(drain(gen)).rejects.toBeInstanceOf(CloseError)
      // Both consultations report attempt 0: each connection opened
      // successfully before closing, and a stable open resets the counter.
      expect(attempts).toEqual([0, 0])
    })
  })

  describe('hooks', () => {
    it('fires onOpen once with a sender, then onReconnect per later connection', async () => {
      const { createTransport } = scripted([
        { messages: [], end: 'error', error: new SocketError(new Error('x')) },
        { messages: [], end: 'error', error: new SocketError(new Error('y')) },
        { messages: [], end: 'clean' },
      ])
      const onOpen = vi.fn()
      const onReconnect = vi.fn()
      const websocket = createWebSocket(createTransport)
      await drain(websocket('ws://x', { ...noBackoff, onOpen, onReconnect }))
      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onReconnect).toHaveBeenCalledTimes(2)
      expect(typeof onOpen.mock.calls[0]?.[0]?.send).toBe('function')
    })

    it('fires onClose exactly once with the last close detail', async () => {
      const { createTransport } = scripted([
        {
          messages: [],
          end: 'clean',
          detail: { code: CloseCode.Normal, reason: 'bye', wasClean: true },
        },
      ])
      const onClose = vi.fn()
      const websocket = createWebSocket(createTransport)
      await drain(websocket('ws://x', { ...noBackoff, onClose }))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledWith({
        code: CloseCode.Normal,
        reason: 'bye',
        wasClean: true,
      })
    })

    it('fires onClose on a consumer break', async () => {
      const { createTransport } = scripted([
        { messages: ['a', 'b'], end: 'clean' },
      ])
      const onClose = vi.fn()
      const websocket = createWebSocket(createTransport)
      for await (const m of websocket('ws://x', { ...noBackoff, onClose })) {
        expect(m).toBe('a')
        break
      }
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('tears the connection down on a consumer break', async () => {
      const { createTransport, signals } = scripted([
        { messages: ['a', 'b'], end: 'clean' },
      ])
      const websocket = createWebSocket(createTransport)
      for await (const _ of websocket('ws://x', noBackoff)) break
      // A break resumes the generator at its `yield*`, so the teardown has to
      // live in a `finally` to run at all.
      expect(signals[0]?.aborted).toBe(true)
    })

    it('synthesizes 1005 for onClose when no close frame applied', async () => {
      // Nothing ever connected, so no detail was ever captured.
      const createTransport = (() => {
        throw new SocketError(new Error('dns'))
      }) as unknown as TransportFactory
      const onClose = vi.fn()
      const websocket = createWebSocket(createTransport)
      await expect(
        drain(websocket('ws://x', { shouldReconnect: false, onClose })),
      ).rejects.toBeInstanceOf(SocketError)
      expect(onClose).toHaveBeenCalledWith({
        code: CloseCode.NoStatus,
        reason: '',
        wasClean: false,
      })
    })

    it('does not fire onClose for a generator that was never pulled', async () => {
      const { createTransport } = scripted([{ messages: [], end: 'clean' }])
      const onClose = vi.fn()
      const websocket = createWebSocket(createTransport)
      // Creating a generator runs none of its body: no lifecycle, no onClose.
      websocket('ws://x', { ...noBackoff, onClose })
      await Promise.resolve()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('surfaces a throwing hook as an uncaught exception without failing the stream', async () => {
      const { createTransport } = scripted([{ messages: ['a'], end: 'clean' }])
      const websocket = createWebSocket(createTransport)
      const thrown = new Error('bad hook')
      // invokeHook rethrows on a microtask: a bad hook crashes visibly rather
      // than unwinding through the loop's state. Intercept the process-level
      // exception so this deliberate crash is *asserted* rather than merely
      // escaping into the runner (which would fail the suite).
      const uncaught = new Promise<unknown>((resolve) => {
        process.once('uncaughtException', resolve)
      })
      const messages = await drain(
        websocket('ws://x', {
          ...noBackoff,
          onOpen: () => {
            throw thrown
          },
        }),
      )
      // The stream is unaffected by the hook's failure...
      expect(messages).toEqual(['a'])
      // ...and the error still reached the process, rather than being swallowed.
      await expect(uncaught).resolves.toBe(thrown)
    })
  })

  describe('signal', () => {
    it('rejects the first pull when already aborted', async () => {
      const { createTransport } = scripted([])
      const websocket = createWebSocket(createTransport)
      const reason = new Error('nope')
      // The body doesn't run until the first pull, so this is where it lands.
      const gen = websocket('ws://x', { signal: AbortSignal.abort(reason) })
      await expect(gen.next()).rejects.toBe(reason)
    })

    it('rejects the iterator with the abort reason mid-stream', async () => {
      const controller = new AbortController()
      const { createTransport } = parkingTransport()
      const websocket = createWebSocket(createTransport)
      const reason = new Error('stopped')
      const gen = websocket('ws://x', { signal: controller.signal })
      const pull = gen.next()
      controller.abort(reason)
      await expect(pull).rejects.toBe(reason)
    })

    it('tears the live connection down on abort', async () => {
      const controller = new AbortController()
      const { createTransport, wasTornDown } = parkingTransport()
      const websocket = createWebSocket(createTransport)
      const gen = websocket('ws://x', { signal: controller.signal })
      const pull = gen.next()
      controller.abort(new Error('stop'))
      await expect(pull).rejects.toThrow('stop')
      expect(wasTornDown()).toBe(true)
    })

    it('fires onClose exactly once on abort', async () => {
      const controller = new AbortController()
      const { createTransport } = parkingTransport()
      const onClose = vi.fn()
      const websocket = createWebSocket(createTransport)
      const gen = websocket('ws://x', { signal: controller.signal, onClose })
      const pull = gen.next()
      controller.abort(new Error('stop'))
      await expect(pull).rejects.toThrow('stop')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect after an abort', async () => {
      const controller = new AbortController()
      const { createTransport, urls } = scripted([
        { messages: [], end: 'error', error: new SocketError(new Error('x')) },
        { messages: [], end: 'clean' },
      ])
      const websocket = createWebSocket(createTransport)
      const gen = websocket('ws://x', {
        ...noBackoff,
        signal: controller.signal,
      })
      // Abort before the first pull; the first attempt still runs, but its
      // failure must surface the abort reason rather than being retried.
      const pull = gen.next()
      controller.abort(new Error('stop'))
      await expect(pull).rejects.toThrow()
      expect(urls.length).toBeLessThanOrEqual(1)
    })
  })

  it('resets the backoff after a successful open', async () => {
    const { createTransport } = scripted([
      { messages: [], end: 'error', error: new SocketError(new Error('1')) },
      { messages: ['a'], end: 'error', error: new SocketError(new Error('2')) },
      { messages: [], end: 'clean' },
    ])
    const delays: number[] = []
    using _spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      delays.push(ms ?? 0)
      fn()
      return 0
    }) as unknown as typeof setTimeout)
    const websocket = createWebSocket(createTransport)
    await drain(websocket('ws://x'))
    // Both backoffs are first-attempt-sized (~1s, not 1s then 2s): the second
    // failure followed a successful open, which resets the counter.
    expect(delays).toHaveLength(2)
    expect(delays[0]).toBeLessThan(2000)
    expect(delays[1]).toBeLessThan(2000)
  })
})
