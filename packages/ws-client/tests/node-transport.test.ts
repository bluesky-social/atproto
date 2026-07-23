import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { describe, expect, it, vi } from 'vitest'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { WebSocketConnection } from '../src/index.ts'

async function startServer(
  onConnection: (ws: WebSocket, req: IncomingMessage) => void,
) {
  const server = createServer()
  const { terminate } = httpTerminator.createHttpTerminator({ server })
  const wss = new WebSocketServer({ server })
  wss.on('connection', (ws, req) => onConnection(ws, req))
  await once(server.listen(0), 'listening')
  const port = (server.address() as AddressInfo).port
  return { url: `ws://localhost:${port}`, terminate }
}

describe('NodeTransport via WebSocketConnection', () => {
  it('yields text messages then ends on clean close', async () => {
    const { url, terminate } = await startServer((ws) => {
      ws.send('hello')
      ws.send('world')
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    let closeDetail: { code: number } | undefined
    const ws = new WebSocketConnection(url, {
      dataMode: 'text',
      onClose: (detail) => (closeDetail = detail),
    })
    const received: string[] = []
    for await (const msg of ws) received.push(msg)
    expect(received).toEqual(['hello', 'world'])
    expect(closeDetail).toMatchObject({ code: 1000 })
  })

  it('yields binary frames as Uint8Array in binary mode', async () => {
    const { url, terminate } = await startServer((ws) => {
      ws.send(Buffer.from([1, 2, 3]))
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const ws = new WebSocketConnection(url, { dataMode: 'binary' })
    const received: Uint8Array[] = []
    for await (const msg of ws) received.push(msg)
    expect(received).toHaveLength(1)
    expect(Array.from(received[0])).toEqual([1, 2, 3])
  })

  it('send() delivers to the server and resolves on flush', async () => {
    const seen: string[] = []
    const { url, terminate } = await startServer((ws) => {
      ws.on('message', (data) => {
        seen.push(data.toString())
        ws.close(1000)
      })
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    let onOpen!: () => void
    const opened = new Promise<void>((resolve) => (onOpen = resolve))
    const ws = new WebSocketConnection(url, { dataMode: 'text', onOpen })
    // Lazy open: begin draining so the transport opens, then send once open.
    const drained = (async () => {
      for await (const _msg of ws) {
        /* drain until close */
      }
    })()
    await opened
    await ws.send('ping')
    await drained
    expect(seen).toEqual(['ping'])
  })

  it('reports pauseResume + heartbeat capabilities', async () => {
    const { url, terminate } = await startServer((ws) => ws.close(1000))
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    const ws = new WebSocketConnection(url)
    expect(ws.capabilities).toEqual({ heartbeat: true, pauseResume: true })
    for await (const _msg of ws) {
      /* drain */
    }
  })

  it('sends custom headers on the upgrade request (record form)', async () => {
    let seenAuth: string | undefined
    const { url, terminate } = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const wsc = new WebSocketConnection(url, {
      headers: { Authorization: 'Bearer t0ken' },
    })
    for await (const _msg of wsc) {
      /* drain */
    }
    expect(seenAuth).toBe('Bearer t0ken')
  })

  it('sends custom headers from a WHATWG Headers instance', async () => {
    let seenAuth: string | undefined
    const { url, terminate } = await startServer((ws, req) => {
      seenAuth = req.headers['authorization']
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const wsc = new WebSocketConnection(url, {
      headers: new Headers({ Authorization: 'Bearer hdr' }),
    })
    for await (const _msg of wsc) {
      /* drain */
    }
    expect(seenAuth).toBe('Bearer hdr')
  })

  it('does not open the socket until open() is called', async () => {
    const { url, terminate } = await startServer((ws) => ws.close(1000))
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    const { NodeTransport } = await import('../src/transport/node-transport.js')
    const transport = new NodeTransport(url)
    // Wire minimal handlers so open() has something to call.
    let opened = false
    transport.handlers = {
      onOpen: () => (opened = true),
      onMessage: () => {},
      onPong: () => {},
      onClose: () => {},
      onError: () => {},
    }
    // Before open(): no connection attempt, so no open callback can fire.
    await new Promise((r) => setTimeout(r, 20))
    expect(opened).toBe(false)
    transport.open()
    // After open(): the socket connects and fires onOpen.
    await vi.waitFor(() => expect(opened).toBe(true))
    transport.close(1000)
  })
})
