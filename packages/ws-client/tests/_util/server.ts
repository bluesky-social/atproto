import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createHttpTerminator } from 'http-terminator'
import { type ServerOptions, type WebSocket, WebSocketServer } from 'ws'

/**
 * Start a WebSocket echo-style test server; dispose with `await using`:
 *
 *     await using server = await startServer((ws) => { ... })
 *     server.url
 *
 * `port` defaults to an OS-assigned ephemeral port (0). Pass an explicit port to
 * rebind an address a prior server has released — e.g. taking the port off the
 * first server's own `url` to simulate a restart, which avoids the race of
 * reserving a port and binding it later.
 */
export async function startServer(
  onConnection: (ws: WebSocket, req: IncomingMessage) => void,
  wssOptions?: ServerOptions,
  port = 0,
): Promise<{ url: string } & AsyncDisposable> {
  const server = createServer()
  const { terminate } = createHttpTerminator({ server })
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
