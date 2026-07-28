import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { type ServerOptions, type WebSocket, WebSocketServer } from 'ws'

/**
 * Start a WebSocket echo-style test server; dispose with `await using`:
 *
 *     await using server = await startServer((ws) => { ... })
 *     server.url
 *
 * `port` defaults to an OS-assigned ephemeral port (0); pass an explicit port
 * — e.g. one obtained from `get-port` — to rebind the same address after a
 * prior server on it has been disposed, such as when simulating a server
 * restart.
 */
export async function startServer(
  onConnection: (ws: WebSocket, req: IncomingMessage) => void,
  wssOptions?: ServerOptions,
  port = 0,
): Promise<{ url: string } & AsyncDisposable> {
  const server = createServer()
  const { terminate } = httpTerminator.createHttpTerminator({ server })
  const wss = new WebSocketServer({ ...wssOptions, server })
  wss.on('connection', onConnection)
  await once(server.listen(port), 'listening')
  const boundPort = (server.address() as AddressInfo).port
  return {
    url: `ws://localhost:${boundPort}`,
    [Symbol.asyncDispose]: async () => {
      await terminate()
    },
  }
}
