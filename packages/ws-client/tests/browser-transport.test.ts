import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { WebSocket as UndiciWebSocket } from 'undici'
import { describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { WebSocketConnectionEngine } from '../src/connection.ts'
import { BrowserTransport } from '../src/transport/browser-transport.ts'
import type { TransportOptions } from '../src/transport/transport.ts'

async function startServer(onConnection: (ws: WebSocket) => void) {
  const server = createServer()
  const { terminate } = httpTerminator.createHttpTerminator({ server })
  const wss = new WebSocketServer({ server })
  wss.on('connection', onConnection)
  await once(server.listen(0), 'listening')
  const port = (server.address() as AddressInfo).port
  return { url: `ws://localhost:${port}`, terminate }
}

// Factory that binds the undici WebSocket as the browser-global stand-in.
const factory = (url: string | URL, options?: TransportOptions) =>
  new BrowserTransport(url, options, UndiciWebSocket as never)

describe('BrowserTransport via engine', () => {
  it('reports heartbeat:false, pauseResume:false', async () => {
    const { url, terminate } = await startServer((ws) => ws.close(1000))
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    const engine = new WebSocketConnectionEngine(factory, url)
    expect(engine.capabilities).toEqual({
      heartbeat: false,
      pauseResume: false,
    })
    for await (const _msg of engine) {
      /* drain */
    }
  })

  it('yields text and ends on clean close', async () => {
    const { url, terminate } = await startServer((ws) => {
      ws.send('hi')
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    const engine = new WebSocketConnectionEngine<'text'>(factory, url, {
      dataMode: 'text',
    })
    const received: string[] = []
    for await (const msg of engine) received.push(msg)
    expect(received).toEqual(['hi'])
  })

  it('yields binary frames as Uint8Array', async () => {
    const { url, terminate } = await startServer((ws) => {
      ws.send(Buffer.from([9, 8, 7]))
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    const engine = new WebSocketConnectionEngine<'binary'>(factory, url, {
      dataMode: 'binary',
    })
    const received: Uint8Array[] = []
    for await (const msg of engine) received.push(msg)
    expect(received).toHaveLength(1)
    expect(Array.from(received[0])).toEqual([9, 8, 7])
  })

  it('send resolves (transport-accepted semantics)', async () => {
    const seen: string[] = []
    const { url, terminate } = await startServer((ws) => {
      ws.on('message', (d) => {
        seen.push(d.toString())
        ws.close(1000)
      })
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    let onOpen!: () => void
    const opened = new Promise<void>((resolve) => (onOpen = resolve))
    const engine = new WebSocketConnectionEngine<'text'>(factory, url, {
      dataMode: 'text',
      onOpen,
    })
    // Lazy open: begin draining so the transport opens, then send once open.
    const drained = (async () => {
      for await (const _msg of engine) {
        /* drain */
      }
    })()
    await opened
    await engine.send('yo')
    await drained
    expect(seen).toEqual(['yo'])
  })

  it('throws on construction when headers are provided (record form)', () => {
    expect(
      () =>
        new BrowserTransport('ws://x', {
          headers: { Authorization: 'Bearer t0ken' },
        }),
    ).toThrow(TypeError)
  })

  it('throws on construction when headers are provided (Headers form)', () => {
    expect(
      () =>
        new BrowserTransport('ws://x', {
          headers: new Headers({ Authorization: 'Bearer t0ken' }),
        }),
    ).toThrow(TypeError)
  })

  it('does not throw for absent or empty headers', () => {
    expect(() => new BrowserTransport('ws://x')).not.toThrow()
    expect(() => new BrowserTransport('ws://x', { headers: {} })).not.toThrow()
    expect(
      () => new BrowserTransport('ws://x', { headers: new Headers() }),
    ).not.toThrow()
  })
})
