import { once } from 'node:events'
import { type IncomingMessage, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type WebSocket, WebSocketServer } from 'ws'
import { type LexValue, encode } from '@atproto/lex-cbor'

/** Encodes an XRPC event stream frame: a CBOR header followed by a CBOR body. */
export function frame(header: LexValue, body: LexValue): Buffer {
  return Buffer.concat([encode(header), encode(body)])
}

/**
 * Starts a WebSocket server; dispose with `await using`. `onConnection` is
 * called for every connection, with its 0-based index. `requests` records every
 * upgrade request, so a test can assert on the URLs a subscription dialed.
 */
export async function startWebSocketServer(
  onConnection: (connection: {
    ws: WebSocket
    req: IncomingMessage
    index: number
  }) => void,
) {
  const requests: IncomingMessage[] = []
  const server = createServer()
  const wss = new WebSocketServer({ server })
  let index = 0
  wss.on('connection', (ws, req) => {
    requests.push(req)
    onConnection({ ws, req, index: index++ })
  })
  await once(server.listen(0), 'listening')
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://localhost:${port}`,
    requests,
    async [Symbol.asyncDispose]() {
      for (const ws of wss.clients) ws.terminate()
      wss.close()
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}
