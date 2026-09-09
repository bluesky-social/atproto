import { encode } from '@atproto/lex-cbor'
import {
  type LexErrorData,
  type LexValue,
  isPlainObject,
  ui8Concat,
} from '@atproto/lex-data'
import type { Subscription } from '@atproto/lex-schema'
import { abortableSleep } from './sleep.js'

export function closeSubscription(
  ws: WebSocket,
  code: number,
  data: LexErrorData,
) {
  const frame = encodeErrorFrame(data)

  if (isNodeWebSocket(ws)) {
    // Close the WebSocket only after the message has been sent down the wire.
    // Note that we set a timeout to ensure the WebSocket is closed even if the
    // send callback is not called.
    const timer = setTimeout(() => {
      ws.close(code, data.error)
    }, 5_000)
    ws.send(frame, undefined, () => {
      clearTimeout(timer)
      ws.close(code, data.error)
    })
  } else {
    ws.send(frame)
    ws.close(code, data.error)
  }
}

export async function sendSubscriptionMessage(
  socket: WebSocket,
  method: Subscription,
  value: LexValue,
  signal: AbortSignal,
  options?: WebsocketBackpressureOptions,
) {
  socket.send(encodeMessageFrame(method, value))

  // Apply backpressure by waiting for the buffered data to drain
  // before generating the next message
  return drainWebsocket(socket, signal, options)
}

export type WebsocketBackpressureOptions = {
  highWaterMark?: number
  lowWaterMark?: number
}

/**
 * Performs polling based backpressure management for a WebSocket connection. If
 * the amount of buffered data exceeds the specified high water mark, this
 * function will wait until the buffered amount drops below the low water mark
 * before resolving. This is useful for preventing memory issues when sending
 * large amounts of data over a WebSocket connection.
 */
export async function drainWebsocket(
  socket: WebSocket,
  signal: AbortSignal,
  {
    highWaterMark = 250_000, // 250 KB
    lowWaterMark = 50_000, // 50 KB
  }: WebsocketBackpressureOptions = {},
): Promise<void> {
  if (socket.bufferedAmount > highWaterMark) {
    // Once we exceed the high water mark, we wait until the buffered amount
    // drops below the low water mark before allowing more data to be sent. This
    // creates a hysteresis effect that prevents rapid toggling around the
    // threshold.
    while (
      socket.readyState === 1 &&
      socket.bufferedAmount !== 0 &&
      socket.bufferedAmount > lowWaterMark
    ) {
      await abortableSleep(10, signal)
    }
  }
}

/**
 * Node.js WebSocket with 3-argument send signature (that allows for back
 * pressure).
 */
type NodeWebSocket = WebSocket & {
  _sender: unknown
  _receiver: unknown

  send: (
    data: Uint8Array<ArrayBuffer>,
    options?: {
      binary?: boolean
      compress?: boolean
      mask?: boolean
      fin?: boolean
    },
    callback?: () => void,
  ) => void
}

function isNodeWebSocket(ws: WebSocket): ws is NodeWebSocket {
  return '_sender' in ws && '_receiver' in ws && ws.send.length === 3
}

// Pre-encoded frame header for error frames
const ERROR_FRAME_HEADER = /*#__PURE__*/ encode({ op: -1 })

function encodeErrorFrame(errorData: LexErrorData): Uint8Array<ArrayBuffer> {
  return ui8Concat([ERROR_FRAME_HEADER, encode(errorData)])
}

// Pre-encoded frame header for message frames with unknown type
const UNKNOWN_MESSAGE_FRAME_HEADER = /*#__PURE__*/ encode({ op: 1 })

function encodeMessageFrame(
  method: Subscription,
  value: LexValue,
): Uint8Array<ArrayBuffer> {
  if (isPlainObject(value) && typeof value.$type === 'string') {
    const { $type, ...rest } = value
    return ui8Concat([
      encode({
        op: 1,
        t:
          // If $type starts with `nsid#`, strip the NSID prefix
          $type.charCodeAt(0) !== 0x23 && // '#'
          $type.charCodeAt(method.nsid.length) === 0x23 && // '#'
          $type.startsWith(method.nsid)
            ? $type.slice(method.nsid.length)
            : $type,
      }),
      encode(rest),
    ])
  }

  return ui8Concat([UNKNOWN_MESSAGE_FRAME_HEADER, encode(value)])
}
