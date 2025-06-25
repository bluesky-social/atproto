import { createWebSocketStream, WebSocket } from 'ws'

import { getDecoder } from './decoder.js'
import { buildUrl, EndpointOptions } from './endpoint.js'
import { wait } from './lib/util.js'
import { isKnownEvent, KnownEvent, UnknownEvent } from './types/events.js'

export type JetstreamOptions = EndpointOptions & {
  retry?: (failedAttempts: number, cause: unknown) => false | number
}

export async function* jetstream({
  // Retry 6 times, with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s ~= 61s total)
  retry = (attempt) => attempt <= 6 && 1e3 * Math.min(30, 2 ** (attempt - 1)),

  // Endpoint options
  compress = true,
  cursor = undefined,
  wantedCollections = undefined,
  endpoint = undefined,
  wantedDids = undefined,
}: JetstreamOptions): AsyncGenerator<KnownEvent> {
  const decoder = compress ? await getDecoder() : null

  let failedAttempts = 0

  while (true) {
    try {
      const url = buildUrl({
        compress,
        cursor,
        wantedCollections,
        wantedDids,
        endpoint,
      })

      const ws = new WebSocket(url)

      const stream = createWebSocketStream(ws, { readableObjectMode: true })

      for await (const bytes of stream) {
        const decoded = decoder ? await decoder.decode(bytes) : bytes

        const event = JSON.parse(decoded.toString()) as UnknownEvent

        if (isKnownEvent(event)) yield event
        // Ignore unknown or malformed event

        failedAttempts = 0

        cursor = event.time_us + 1
      }
    } catch (cause: unknown) {
      failedAttempts++

      const shouldRetry = retry(failedAttempts, cause)
      if (shouldRetry === false) throw cause
      if (shouldRetry > 0) await wait(shouldRetry)
    }
  }
}
