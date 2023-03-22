import { XRPCError, ResponseType } from '@atproto/xrpc'
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

export async function* byMessage(ws: WebSocket, options?: DuplexOptions) {
  for await (const frame of byFrame(ws, options)) {
    if (frame.isMessage()) {
      yield frame
    } else if (frame.isError()) {
      throw new XRPCError(-1, frame.code, frame.message)
    } else {
      throw new XRPCError(ResponseType.Unknown, undefined, 'Unknown frame type')
    }
  }
}
