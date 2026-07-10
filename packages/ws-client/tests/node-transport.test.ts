import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { describe, expect, it } from 'vitest'
import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { WebSocketCore } from '../src/node.ts'

async function startServer(onConnection: (ws: WebSocket) => void) {
  const server = createServer()
  const { terminate } = httpTerminator.createHttpTerminator({ server })
  const wss = new WebSocketServer({ server })
  wss.on('connection', onConnection)
  await once(server.listen(0), 'listening')
  const port = (server.address() as AddressInfo).port
  return { url: `ws://localhost:${port}`, terminate }
}

describe('NodeTransport via WebSocketCore', () => {
  it('yields text messages then ends on clean close', async () => {
    const { url, terminate } = await startServer((ws) => {
      ws.send('hello')
      ws.send('world')
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const ws = new WebSocketCore(url, { dataMode: 'text' })
    const received: string[] = []
    for await (const msg of ws) received.push(msg)
    expect(received).toEqual(['hello', 'world'])
    await expect(ws.closed).resolves.toMatchObject({ code: 1000 })
  })

  it('yields binary frames as Uint8Array in binary mode', async () => {
    const { url, terminate } = await startServer((ws) => {
      ws.send(Buffer.from([1, 2, 3]))
      ws.close(1000)
    })
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }

    const ws = new WebSocketCore(url, { dataMode: 'binary' })
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

    const ws = new WebSocketCore(url, { dataMode: 'text' })
    await ws.opened
    await ws.send('ping')
    for await (const _msg of ws) {
      /* drain until close */
    }
    expect(seen).toEqual(['ping'])
  })

  it('reports pauseResume + heartbeat capabilities', async () => {
    const { url, terminate } = await startServer((ws) => ws.close(1000))
    await using _ = { [Symbol.asyncDispose]: async () => terminate() }
    const ws = new WebSocketCore(url)
    expect(ws.capabilities).toEqual({ heartbeat: true, pauseResume: true })
    for await (const _msg of ws) {
      /* drain */
    }
  })
})
