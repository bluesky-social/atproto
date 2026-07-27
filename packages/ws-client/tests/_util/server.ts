import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { type WebSocket, WebSocketServer } from 'ws'

/**
 * Start a WebSocket echo-style test server; dispose with `await using`:
 *
 *     await using server = await startServer((ws) => { ... })
 *     server.url
 */
export async function startServer(
  onConnection: (ws: WebSocket, req: IncomingMessage) => void,
): Promise<{ url: string } & AsyncDisposable> {
  const server = createServer()
  const { terminate } = httpTerminator.createHttpTerminator({ server })
  const wss = new WebSocketServer({ server })
  wss.on('connection', onConnection)
  await once(server.listen(0), 'listening')
  const port = (server.address() as AddressInfo).port
  return {
    url: `ws://localhost:${port}`,
    [Symbol.asyncDispose]: async () => {
      await terminate()
    },
  }
}
