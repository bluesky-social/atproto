import { DuplexOptions } from 'node:stream'
import { WebSocket, createWebSocketStream } from 'ws'
import { ResponseType } from '@atproto/xrpc'
import { XRPCError } from '../errors'
import { Frame, MessageFrame } from './frames'

export function streamByteChunks(ws: WebSocket, options?: DuplexOptions) {
  return createWebSocketStream(ws, {
    ...options,
    readableObjectMode: true, // Ensures frame bytes don't get buffered/combined together
  })
}

export async function* byFrame(ws: WebSocket, options?: DuplexOptions) {
  const wsStream = streamByteChunks(ws, options)
  for await (const chunk of wsStream) {
    yield Frame.fromBytes(chunk)
  }
}

export async function* byMessage(ws: WebSocket, options?: DuplexOptions) {
  const wsStream = streamByteChunks(ws, options)
  for await (const chunk of wsStream) {
    const msg = ensureChunkIsMessage(chunk)
    yield msg
  }
}

export function ensureChunkIsMessage(chunk: Uint8Array): MessageFrame {
  const frame = Frame.fromBytes(chunk)
  if (frame.isMessage()) {
    return frame
  } else if (frame.isError()) {
    const type = ResponseType[frame.code] ?? ResponseType.UpstreamFailure
    throw new XRPCError(type, frame.message, frame.code)
  } else {
    throw new XRPCError(ResponseType.InvalidResponse, 'Unknown frame type')
  }
}
