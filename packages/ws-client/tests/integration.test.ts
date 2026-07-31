import { assert, describe, expect, it, vi } from 'vitest'
import {
  CloseCode,
  CloseError,
  type Sender,
  WebSocketClientError,
  websocket,
} from '../src/index.ts'
import type { CloseEventDetail } from '../src/message-channel.ts'
import { startServer } from './_util/server.js'

// Drains a generator into an array. A non-reconnectable clean close ends the
// generator normally rather than rejecting, so most tests below resolve here.
async function drain<T>(gen: AsyncGenerator<T, void, unknown>): Promise<T[]> {
  const out: T[] = []
  for await (const m of gen) out.push(m)
  return out
}

// maxReconnectSeconds: 0 caps the backoff at 0ms so reconnect scenarios below
// don't stall on the exponential wait.
const noBackoff = { maxReconnectSeconds: 0 }

describe('websocket() end-to-end over real sockets', () => {
  it('round-trips text and binary frames with dataMode honored', async () => {
    await using server = await startServer((ws) => {
      ws.send('hello')
      ws.send(Buffer.from([1, 2, 3]))
      ws.close(CloseCode.Normal)
    })
    // A server-sent 1000 is fatal but clean under the default policy, so the
    // stream ends rather than rejecting and drain() resolves.
    const messages = await drain(websocket(server.url))
    expect(messages).toHaveLength(2)
    expect(messages[0]).toBe('hello')
    assert(messages[1] instanceof Uint8Array)
    expect(Array.from(messages[1])).toEqual([1, 2, 3])
  })

  it('honors dataMode through the full stack on a mismatched frame', async () => {
    await using server = await startServer((ws) => {
      ws.send(Buffer.from([9, 9, 9]))
    })
    const gen = websocket(server.url, { dataMode: 'text' })
    // DataModeError isn't retryable, so this rejects rather than redialing a
    // server that will keep sending the same frame.
    await expect(gen.next()).rejects.toSatisfy((err: unknown) => {
      expect((err as Error).name).toBe('DataModeError')
      return true
    })
  })

  it('survives a server restart, continuing iteration across the gap', async () => {
    // The port comes from the first server's own bind rather than being reserved
    // up front, since another process or a parallel worker could claim it between
    // the reservation and the bind.
    let server = await startServer((ws) => {
      ws.send('first')
      ws.close(CloseCode.GoingAway, 'restarting')
    })
    const { port } = new URL(server.url)

    const gen = websocket(server.url, noBackoff)
    expect(await gen.next()).toEqual({ value: 'first', done: false })

    // The first server is gone and a second takes its place on the same port.
    // Only on the next pull below does the reconnect loop notice the close and
    // redial; the consumer sees one continuous stream, not the gap.
    await server[Symbol.asyncDispose]()
    server = await startServer(
      (ws) => {
        ws.send('second')
      },
      undefined,
      Number(port),
    )

    try {
      expect(await gen.next()).toEqual({ value: 'second', done: false })
    } finally {
      await gen.return()
      await server[Symbol.asyncDispose]()
    }
  })

  it('delivers headers to the server upgrade request', async () => {
    let seenAuth: string | undefined
    await using server = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(CloseCode.Normal)
    })
    await drain(
      websocket(server.url, { headers: { Authorization: 'Bearer t0ken' } }),
    )
    expect(seenAuth).toBe('Bearer t0ken')
  })

  it('keeps an idle connection alive via heartbeat against a real server', async () => {
    // `ws` answers protocol pings automatically (autoPong defaults to true),
    // so a server that never sends anything still keeps the heartbeat happy.
    await using server = await startServer(() => {})
    const controller = new AbortController()
    const onClose = vi.fn()
    const gen = websocket(server.url, {
      heartbeat: { intervalMs: 30 },
      signal: controller.signal,
      onClose,
    })
    const pull = gen.next()
    // Outlive several heartbeat intervals without the stream ending.
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(onClose).not.toHaveBeenCalled()
    const reason = new Error('test cleanup')
    controller.abort(reason)
    await expect(pull).rejects.toBe(reason)
  })

  it('ends iteration promptly with the abort reason on signal abort', async () => {
    await using server = await startServer(() => {
      // Never sends, so the consumer's pull parks until aborted.
    })
    const controller = new AbortController()
    const gen = websocket(server.url, { signal: controller.signal })
    const pull = gen.next()
    const reason = new Error('stop')
    controller.abort(reason)
    await expect(pull).rejects.toBe(reason)
  })

  it('closes the socket when the consumer breaks out of the loop', async () => {
    let resolveClosed!: () => void
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve
    })
    await using server = await startServer((ws) => {
      ws.send('one')
      ws.send('two')
      ws.on('close', () => resolveClosed())
    })
    for await (const message of websocket(server.url)) {
      expect(message).toBe('one')
      break
    }
    await closed
  })

  it('reports a consumer break as a clean 1000 close', async () => {
    // The socket really does close at 1000 here; the bug was in what got
    // *reported*. Teardown used to terminate over the close handshake it had just
    // initiated, and a terminated handshake reports 1006 locally even though the
    // peer saw 1000 — so a graceful shutdown looked abnormal to anything keying on
    // `wasClean`.
    let serverSaw: number | undefined
    let resolveClosed!: () => void
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve
    })
    await using server = await startServer((ws) => {
      ws.send('one')
      ws.send('two')
      ws.on('close', (code) => {
        serverSaw = code
        resolveClosed()
      })
    })

    const closes: CloseEventDetail[] = []
    for await (const message of websocket(server.url, {
      dataMode: 'text',
      onClose: (detail) => closes.push(detail),
    })) {
      expect(message).toBe('one')
      break
    }
    await closed

    expect(serverSaw).toBe(CloseCode.Normal)
    expect(closes).toEqual([
      { code: CloseCode.Normal, reason: '', wasClean: true },
    ])
  })

  describe('how a stop maps onto the close', () => {
    // The abort reason decides how the socket ends, so a caller can ask for a
    // specific close code without a separate knob. `break` and `throw` in a
    // `for await` are indistinguishable to a generator — both produce a return
    // completion, never `throw()` — so they share the plain clean close.
    async function stopWith(
      reason: unknown,
    ): Promise<{ serverSaw?: number; serverReason?: string }> {
      let serverSaw: number | undefined
      let serverReason: string | undefined
      let resolveClosed!: () => void
      const closed = new Promise<void>((resolve) => {
        resolveClosed = resolve
      })
      await using server = await startServer((ws) => {
        ws.send('one')
        ws.on('close', (code, buf) => {
          serverSaw = code
          serverReason = buf.toString()
          resolveClosed()
        })
      })
      const controller = new AbortController()
      const gen = websocket(server.url, {
        dataMode: 'text',
        signal: controller.signal,
      })
      await gen.next()
      controller.abort(reason)
      await expect(gen.next()).rejects.toBeDefined()
      await closed
      return { serverSaw, serverReason }
    }

    it('closes politely at 1000 on a bare abort', async () => {
      // `ac.abort()` with no argument is an AbortError — a plain "please stop".
      const controller = new AbortController()
      controller.abort()
      const { serverSaw } = await stopWith(controller.signal.reason)
      expect(serverSaw).toBe(CloseCode.Normal)
    })

    it('closes with the code carried by a CloseError reason', async () => {
      const { serverSaw, serverReason } = await stopWith(
        new CloseError(CloseCode.Policy, 'over quota', false),
      )
      expect(serverSaw).toBe(CloseCode.Policy)
      expect(serverReason).toBe('')
    })

    it('still closes politely at 1000 on any other reason', async () => {
      // Aborting is a request to stop however it was spelled, so the peer gets a
      // clean goodbye even when the reason is an ordinary Error — the common case
      // being a shutdown sentinel like `ac.abort(new Error('SIGTERM'))`. The
      // reason is not lost: it is what the iterator rejects with.
      const reason = new Error('SIGTERM')
      const { serverSaw } = await stopWith(reason)
      expect(serverSaw).toBe(CloseCode.Normal)
    })

    it('rejects the iterator with the abort reason whatever the close code', async () => {
      const reason = new Error('SIGTERM')
      await using server = await startServer((ws) => ws.send('one'))
      const controller = new AbortController()
      const gen = websocket(server.url, {
        dataMode: 'text',
        signal: controller.signal,
      })
      await gen.next()
      controller.abort(reason)
      await expect(gen.next()).rejects.toBe(reason)
    })
  })

  it('rejects the iterator on a fatal close code rather than reconnecting', async () => {
    // A 1002 close completes its handshake, so it is reported `wasClean: true` —
    // but it is still a failure the consumer must catch, not a completed stream.
    // Only a 1000 close ends the loop normally. Conflating the two would turn a
    // protocol error into a silent, successful end of iteration.
    await using server = await startServer((ws) => {
      ws.close(CloseCode.ProtocolError, 'nope')
    })
    const onClose = vi.fn()
    const gen = websocket(server.url, { onClose })
    await expect(drain(gen)).rejects.toSatisfy((err: unknown) => {
      assert(err instanceof CloseError)
      expect(err.code).toBe(CloseCode.ProtocolError)
      expect(err.shouldRetry()).toBe(false)
      return true
    })
    expect(onClose).toHaveBeenCalledWith({
      code: CloseCode.ProtocolError,
      reason: 'nope',
      wasClean: true,
    })
  })
})

describe('sending over real sockets', () => {
  it('sends through the sender handed to onConnect, and a fresh one per reconnect', async () => {
    // Sending goes through the per-connection sender the hooks hand out, not a
    // client object with a queue. A queued send could only settle on the next
    // connection, which only happens when the consumer pulls, so awaiting one from
    // inside iteration deadlocks. A sender either sends now or rejects, which
    // makes that impossible to write by accident.
    const received: string[] = []
    let firstConnection = true
    await using server = await startServer((ws) => {
      const isFirstConnection = firstConnection
      firstConnection = false
      ws.on('message', (data) => {
        received.push(data.toString())
        if (isFirstConnection) {
          // Force an abrupt, retryable drop so a second connection follows.
          // @ts-expect-error reach into ws internals to force an abrupt drop
          ws._socket.destroy()
        }
      })
    })

    const senders: Sender<'text'>[] = []
    const controller = new AbortController()
    const gen = websocket(server.url, {
      ...noBackoff,
      dataMode: 'text',
      signal: controller.signal,
      // One hook covers every connection, the first included.
      onConnect: (sender) => senders.push(sender),
    })
    // Something has to keep pulling for the loop to reconnect at all.
    const pump = (async () => {
      try {
        for await (const _ of gen) {
          // The server sends nothing in this test.
        }
      } catch {
        // The abort below surfaces here.
      }
    })()

    await vi.waitFor(() => expect(senders).toHaveLength(1))
    await senders[0].send('first')

    // The drop is detected and a second connection brings a fresh sender.
    await vi.waitFor(() => expect(senders).toHaveLength(2))
    await senders[1].send('second')
    await vi.waitFor(() => expect(received).toEqual(['first', 'second']))

    // The dead sender rejects rather than silently dropping the write.
    await expect(senders[0].send('too late')).rejects.toBeInstanceOf(
      WebSocketClientError,
    )

    controller.abort(new Error('test cleanup'))
    await pump
  })

  it('ends a stream parked on a pull when the signal aborts', async () => {
    // Only a real generator exhibits the mechanism under test: a `return()` on a
    // generator suspended inside a `yield*` queues behind the pending pull rather
    // than cancelling it, so `return()` alone can't stop a consumer parked waiting
    // for the next message. The signal is what interrupts the pull, which is why
    // it's the one termination idiom.
    let opened!: () => void
    const isOpen = new Promise<void>((resolve) => {
      opened = resolve
    })
    await using server = await startServer(() => {
      // Never sends, so the pump below parks in next().
    })
    const controller = new AbortController()
    const gen = websocket(server.url, {
      dataMode: 'text',
      signal: controller.signal,
      onConnect: () => opened(),
    })
    const reason = new Error('stopped')
    const pump = (async () => {
      try {
        for await (const _ of gen) {
          // Parks.
        }
        return 'ended'
      } catch (err) {
        return err === reason ? 'aborted' : 'other'
      }
    })()
    await isOpen
    controller.abort(reason)
    await expect(pump).resolves.toBe('aborted')
  })
})
