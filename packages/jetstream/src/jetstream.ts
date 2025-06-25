import { WebSocket, createWebSocketStream } from 'ws'
import { getDecoder } from './decoder.js'
import { EndpointOptions, buildUrl } from './endpoint.js'
import { KnownEvent, UnknownEvent, isKnownEvent } from './types/events.js'
import { wait } from './util.js'

/**
 * Return `false` to stop retrying, or a number of milliseconds (>= 0) to wait
 * before retrying.
 */
export type RetryStrategy = (attempt: number, cause: unknown) => false | number

export type JetstreamOptions = EndpointOptions & {
  retry?: RetryStrategy
  allowUnknownEvents?: boolean
}

export function jetstream(
  options: JetstreamOptions & { allowUnknownEvents: true },
): AsyncGenerator<KnownEvent | UnknownEvent>

export function jetstream(
  options?: JetstreamOptions,
): AsyncGenerator<KnownEvent>

export async function* jetstream({
  retry = (attempt) => attempt <= 6 && 1e3 * Math.min(30, 2 ** (attempt - 1)),
  allowUnknownEvents = false,

  // Endpoint options
  ...options
}: JetstreamOptions = {}) {
  // Use compression by default
  const { compress = true } = options
  const decoder = compress ? await getDecoder() : null

  // Retry
  let { cursor } = options
  let failedAttempts = 0

  while (true) {
    try {
      const url = buildUrl({ ...options, compress, cursor })

      const ws = new WebSocket(url)

      const stream = createWebSocketStream(ws, { readableObjectMode: true })

      for await (const bytes of stream) {
        const decoded = decoder ? await decoder.decode(bytes) : bytes

        const event = JSON.parse(decoded.toString()) as UnknownEvent

        if (allowUnknownEvents) yield event
        else if (isKnownEvent(event)) yield event

        failedAttempts = 0

        cursor = event.time_us + 1
      }
    } catch (cause: unknown) {
      failedAttempts++

      const delay = retry(failedAttempts, cause)
      if (delay === false) throw cause
      if (delay > 0) await wait(delay)
    }
  }
}
