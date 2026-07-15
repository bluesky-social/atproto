import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { WebSocket as UndiciWebSocket } from 'undici'
import { describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { BrowserTransport } from '../src/browser-transport.ts'
import { WebSocketCoreEngine } from '../src/core.ts'
import type { TransportOptions } from '../src/transport.ts'

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
    const engine = new WebSocketCoreEngine(factory, url)
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
    const engine = new WebSocketCoreEngine<'text'>(factory, url, {
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
    const engine = new WebSocketCoreEngine<'binary'>(factory, url, {
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
    const engine = new WebSocketCoreEngine<'text'>(factory, url, {
      dataMode: 'text',
    })
    // Lazy open: begin draining so the transport opens, then send once open.
    const drained = (async () => {
      for await (const _msg of engine) {
        /* drain */
      }
    })()
    await new Promise((resolve) =>
      engine.addEventListener('open', () => resolve(undefined), {
        once: true,
      }),
    )
    await engine.send('yo')
    await drained
    expect(seen).toEqual(['yo'])
  })
})
