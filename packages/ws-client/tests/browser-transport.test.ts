import { WebSocket as UndiciWebSocket } from 'undici'
import { describe, expect, it } from 'vitest'
import { WebSocketConnectionEngine } from '../src/connection.ts'
import { BrowserTransport } from '../src/transport/browser-transport.ts'
import type {
  TransportFactory,
  TransportHandlers,
} from '../src/transport/transport.ts'
import { startServer } from './_util/server.js'

// Factory that binds the undici WebSocket as the browser-global stand-in.
const factory: TransportFactory = (url, handlers, options) =>
  new BrowserTransport(url, handlers, options, UndiciWebSocket as never)

describe('BrowserTransport via engine', () => {
  it('reports heartbeat:false, pauseResume:false', async () => {
    await using server = await startServer((ws) => ws.close(1000))
    const engine = new WebSocketConnectionEngine(factory, server.url)
    expect(engine.capabilities).toEqual({
      heartbeat: false,
      pauseResume: false,
    })
    for await (const _msg of engine) {
      /* drain */
    }
  })

  it('yields text and ends on clean close', async () => {
    await using server = await startServer((ws) => {
      ws.send('hi')
      ws.close(1000)
    })
    const engine = new WebSocketConnectionEngine<'text'>(factory, server.url, {
      dataMode: 'text',
    })
    const received: string[] = []
    for await (const msg of engine) received.push(msg)
    expect(received).toEqual(['hi'])
  })

  it('yields binary frames as Uint8Array', async () => {
    await using server = await startServer((ws) => {
      ws.send(Buffer.from([9, 8, 7]))
      ws.close(1000)
    })
    const engine = new WebSocketConnectionEngine<'binary'>(
      factory,
      server.url,
      {
        dataMode: 'binary',
      },
    )
    const received: Uint8Array[] = []
    for await (const msg of engine) received.push(msg)
    expect(received).toHaveLength(1)
    expect(Array.from(received[0])).toEqual([9, 8, 7])
  })

  it('send resolves (transport-accepted semantics)', async () => {
    const seen: string[] = []
    await using server = await startServer((ws) => {
      ws.on('message', (d) => {
        seen.push(d.toString())
        ws.close(1000)
      })
    })
    let onOpen!: () => void
    const opened = new Promise<void>((resolve) => (onOpen = resolve))
    const engine = new WebSocketConnectionEngine<'text'>(factory, server.url, {
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

  const noopHandlers: TransportHandlers = {
    onOpen() {},
    onMessage() {},
    onPong() {},
    onClose() {},
    onError() {},
  }

  it('throws on construction when headers are provided (record form)', () => {
    expect(
      () =>
        new BrowserTransport('ws://x', noopHandlers, {
          headers: { Authorization: 'Bearer t0ken' },
        }),
    ).toThrow(TypeError)
  })

  it('throws on construction when headers are provided (Headers form)', () => {
    expect(
      () =>
        new BrowserTransport('ws://x', noopHandlers, {
          headers: new Headers({ Authorization: 'Bearer t0ken' }),
        }),
    ).toThrow(TypeError)
  })

  it('does not throw for absent or empty headers', () => {
    expect(() => new BrowserTransport('ws://x', noopHandlers)).not.toThrow()
    expect(
      () => new BrowserTransport('ws://x', noopHandlers, { headers: {} }),
    ).not.toThrow()
    expect(
      () =>
        new BrowserTransport('ws://x', noopHandlers, {
          headers: new Headers(),
        }),
    ).not.toThrow()
  })
})
