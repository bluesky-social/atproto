import { describe, expect, it, vi } from 'vitest'
import { WebSocketClient } from '../src/index.ts'
import { startServer } from './_util/server.js'

describe('WebSocketClient (node integration)', () => {
  it('reconnects after the server drops the connection', async () => {
    let connections = 0
    await using server = await startServer((ws) => {
      connections++
      if (connections === 1) {
        // `ws.close(1006)` throws in the real `ws` lib — 1006 is a
        // synthetic code an endpoint MUST NOT send on the wire (RFC 6455
        // §7.4.1). Simulate a server-forced abnormal drop by terminating
        // the raw socket (no close handshake) after the send flushes, which
        // surfaces as code 1006 on the client.
        ws.send('first', () => ws.terminate())
      } else {
        ws.send('second')
        ws.close(1000)
      }
    })

    const ws = new WebSocketClient(server.url, { dataMode: 'text' })
    const received: string[] = []
    for await (const msg of ws) {
      received.push(msg)
      if (received.length === 2) break
    }
    expect(received).toEqual(['first', 'second'])
    expect(connections).toBeGreaterThanOrEqual(2)
  })

  it('applies headers on each (re)connect', async () => {
    const auths: (string | undefined)[] = []
    let n = 0
    await using server = await startServer((ws, req) => {
      auths.push(req.headers['authorization'])
      const isFirst = n++ === 0
      ws.send(`msg${n - 1}`, () => {
        // See the note in the previous test: simulate an abnormal drop via
        // terminate() rather than the invalid `close(1006)`.
        if (isFirst) ws.terminate()
        else ws.close(1000)
      })
    })

    const ws = new WebSocketClient(server.url, {
      dataMode: 'text',
      headers: { Authorization: 'Bearer tok' },
    })
    const received: string[] = []
    for await (const msg of ws) {
      received.push(msg)
      if (received.length === 2) break
    }
    expect(auths.every((a) => a === 'Bearer tok')).toBe(true)
  })

  it('backoff timer keeps an otherwise-idle process alive to reconnect', async () => {
    // A process whose only pending work is the client's reconnect backoff
    // must not exit mid-backoff — the backoff timer must stay ref'd. Capture
    // the timer created during backoff and assert it holds the event loop.
    let connections = 0
    await using server = await startServer((ws) => {
      connections++
      if (connections === 1) {
        // Abnormal drop (see note in the first test): client should back off
        // ~1s and reconnect.
        ws.send('first', () => ws.terminate())
      } else {
        ws.send('second')
        ws.close(1000)
      }
    })

    // Sample each timer's ref state one microtask after creation: the sleep
    // helper calls unref() synchronously right after setTimeout returns, so
    // this observes the state the timer actually parks with (sampling later
    // won't do — fired timers report hasRef() === false).
    const timerRefs: boolean[] = []
    const realSetTimeout = globalThis.setTimeout
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      ...args: Parameters<typeof setTimeout>
    ) => {
      const timer = realSetTimeout(...args)
      queueMicrotask(() => timerRefs.push(timer.hasRef()))
      return timer
    }) as typeof setTimeout)
    try {
      const ws = new WebSocketClient(server.url, { dataMode: 'text' })
      const received: string[] = []
      for await (const msg of ws) {
        received.push(msg)
        if (msg === 'second') break
      }
      expect(received).toEqual(['first', 'second'])
      expect(connections).toBeGreaterThanOrEqual(2)
      // Every timer the client scheduled (the backoff sleep) must be ref'd,
      // else a process with no other work exits instead of reconnecting.
      expect(timerRefs.length).toBeGreaterThanOrEqual(1)
      expect(timerRefs.every(Boolean)).toBe(true)
    } finally {
      spy.mockRestore()
    }
  }, 15_000)

  it('send() delivers to the server when connected', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (d) => {
        seen.push(d.toString())
        ws.close(1000)
      })
    })

    const ws = new WebSocketClient(server.url, { dataMode: 'text' })
    // Kick off iteration so a connection is established.
    const done = (async () => {
      for await (const _msg of ws) {
        /* drain until close */
      }
    })()
    // Wait until connected, then send.
    while (!ws.connected) await new Promise((r) => setTimeout(r, 5))
    await ws.send('ping')
    await done
    expect(seen).toEqual(['ping'])
  })
})
