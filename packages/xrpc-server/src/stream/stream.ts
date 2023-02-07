import { DuplexOptions } from 'stream'
import { createWebSocketStream, WebSocket } from 'ws'
import { Frame } from './frames'

export async function* byFrame(ws: WebSocket, options?: DuplexOptions) {
  const wsStream = createWebSocketStream(ws, {
    ...options,
    readableObjectMode: true, // Ensures frame bytes don't get buffered/combined together
  })
  for await (const chunk of wsStream) {
    yield Frame.fromBytes(chunk)
  }
}
