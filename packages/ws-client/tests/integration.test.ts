import getPort from 'get-port'
import { assert, describe, expect, it, vi } from 'vitest'
import {
  CloseCode,
  CloseError,
  WebSocketClient,
  websocket,
} from '../src/index.ts'
import { startServer } from './_util/server.js'

// Drains a generator into an array. A non-reconnectable clean close ends the
// generator normally (not a rejection), so most tests below resolve here.
async function drain<T>(gen: AsyncGenerator<T, void, undefined>): Promise<T[]> {
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
    // A server-sent 1000 is fatal-but-clean under the default policy: the
    // stream ends rather than rejecting, so drain() resolves normally.
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
    // DataModeError is not retryable, so this rejects instead of driving a
    // reconnect loop against a server that will keep sending the same frame.
    await expect(gen.next()).rejects.toSatisfy((err: unknown) => {
      expect((err as Error).name).toBe('DataModeError')
      return true
    })
  })

  it('survives a server restart, continuing iteration across the gap', async () => {
    const port = await getPort()
    let server = await startServer(
      (ws) => {
        ws.send('first')
        ws.close(CloseCode.GoingAway, 'restarting')
      },
      undefined,
      port,
    )

    const gen = websocket(`ws://localhost:${port}`, noBackoff)
    expect(await gen.next()).toEqual({ value: 'first', done: false })

    // The first server is gone; a second one takes its place on the same
    // port. Only now (on the next pull below) does the generator's reconnect
    // loop notice the close and redial — the consumer never sees the gap,
    // only a continuous stream of messages.
    await server[Symbol.asyncDispose]()
    server = await startServer(
      (ws) => {
        ws.send('second')
      },
      undefined,
      port,
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

  it('rejects the iterator on a fatal close code rather than reconnecting', async () => {
    await using server = await startServer((ws) => {
      ws.close(CloseCode.ProtocolError, 'nope')
    })
    const gen = websocket(server.url)
    await expect(drain(gen)).rejects.toSatisfy((err: unknown) => {
      assert(err instanceof CloseError)
      expect(err.code).toBe(CloseCode.ProtocolError)
      expect(err.shouldRetry()).toBe(false)
      return true
    })
  })
})

describe('WebSocketClient end-to-end over real sockets', () => {
  it('send() delivers to the server, and a queued send lands after a reconnect', async () => {
    const received: string[] = []
    let firstConnection = true
    await using server = await startServer((ws) => {
      const isFirstConnection = firstConnection
      firstConnection = false
      ws.on('message', (data) => {
        received.push(data.toString())
        if (isFirstConnection) {
          // Force an abrupt, retryable drop right after the first message is
          // received, so a second connection follows.
          // @ts-expect-error reach into ws internals to force an abrupt drop
          ws._socket.destroy()
        }
      })
    })

    let queued: Promise<void> | undefined
    await using client = new WebSocketClient(server.url, {
      ...noBackoff,
      // Fires synchronously the moment the drop is detected — before any
      // reconnect attempt — so queuing here proves the send lands on the
      // *next* connection rather than racing a poll against how fast the
      // reconnect happens to complete.
      onError: () => {
        queued = client.send('queued')
      },
    })
    // The reconnect loop only progresses while something keeps pulling the
    // generator; a background `for await` is what drives it here.
    const pump = (async () => {
      for await (const _ of client) {
        // No messages are expected from the server in this test.
      }
    })()

    await vi.waitFor(() => expect(client.connected).toBe(true))
    await client.send('first')
    await vi.waitFor(() => expect(received).toEqual(['first', 'queued']))
    assert(queued)
    await queued

    await client[Symbol.asyncDispose]()
    await pump
  }, 15000)

  it('asyncDispose ends a stream parked on a pull', async () => {
    // The mechanism matters here, and only a real generator exhibits it: a
    // `return()` on a generator suspended inside a `yield*` queues behind the
    // pending pull rather than cancelling it. A client parked waiting for the
    // next message therefore hangs forever unless disposal also aborts. This
    // test is the one that pins that down — the unit-level equivalent cannot,
    // because its fake is a plain object with no `yield*` in play.
    await using server = await startServer(() => {
      // Never sends, so the pump below parks in next().
    })
    const client = new WebSocketClient(server.url)
    const pump = (async () => {
      for await (const _ of client) {
        // Parks.
      }
      return 'ended'
    })()
    await vi.waitFor(() => expect(client.connected).toBe(true))
    await client[Symbol.asyncDispose]()
    // Disposal is the consumer's own deliberate stop, so the loop completes
    // rather than throwing the abort at it.
    await expect(pump).resolves.toBe('ended')
  })
})
