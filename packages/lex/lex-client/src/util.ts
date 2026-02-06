import {
  DidString,
  InferMethodOutput,
  InferMethodOutputBody,
  Procedure,
  Query,
} from '@atproto/lex-schema'

/**
 * The body type of an XRPC response, inferred from the method's output schema.
 *
 * For JSON responses, this is the parsed LexValue. For binary responses,
 * this is a Uint8Array.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 */
export type XrpcResponseBody<M extends Procedure | Query = Procedure | Query> =
  InferMethodOutputBody<M, Uint8Array>

/**
 * The full payload type of an XRPC response, including body and encoding.
 *
 * Returns `null` for methods that have no output.
 *
 * @typeParam M - The XRPC method type (Procedure or Query)
 */
export type XrpcResponsePayload<
  M extends Procedure | Query = Procedure | Query,
> = InferMethodOutput<M, Uint8Array>

/**
 * Type guard to check if a value is {@link Blob}-like.
 *
 * Handles both native Blobs and polyfilled Blob implementations
 * (e.g., fetch-blob from node-fetch).
 *
 * @param value - The value to check
 * @returns `true` if the value is a Blob or Blob-like object
 */
export function isBlobLike(value: unknown): value is Blob {
  if (value == null) return false
  if (typeof value !== 'object') return false
  if (typeof Blob === 'function' && value instanceof Blob) return true

  // Support for Blobs provided by libraries that don't use the native Blob
  // (e.g. fetch-blob from node-fetch).
  // https://github.com/node-fetch/fetch-blob/blob/a1a182e5978811407bef4ea1632b517567dda01f/index.js#L233-L244

  const tag = (value as any)[Symbol.toStringTag]
  if (tag === 'Blob' || tag === 'File') {
    return 'stream' in value && typeof value.stream === 'function'
  }

  return false
}

export function isAsyncIterable<T>(
  value: T,
): value is unknown extends T
  ? T & AsyncIterable<unknown>
  : Extract<T, AsyncIterable<any>> {
  return (
    value != null && typeof (value as any)[Symbol.asyncIterator] === 'function'
  )
}

/**
 * Builds HTTP headers for AT Protocol requests.
 *
 * Adds the following headers when applicable:
 * - `atproto-proxy`: Service routing header (if service is specified)
 * - `atproto-accept-labelers`: Comma-separated list of labeler DIDs
 *
 * @param options - Header building options
 * @param options.headers - Base headers to include
 * @param options.service - Service proxy identifier
 * @param options.labelers - Labeler DIDs to request labels from
 * @returns A new Headers object with AT Protocol headers added
 */
export function buildAtprotoHeaders(options: {
  headers?: HeadersInit
  service?: `${DidString}#${string}`
  labelers?: Iterable<DidString>
}): Headers {
  const headers = new Headers(options?.headers)

  if (options.service && !headers.has('atproto-proxy')) {
    headers.set('atproto-proxy', options.service)
  }

  if (options.labelers) {
    headers.set(
      'atproto-accept-labelers',
      [...options.labelers, headers.get('atproto-accept-labelers')?.trim()]
        .filter(Boolean)
        .join(', '),
    )
  }

  return headers
}

export function toReadableStream(
  data: AsyncIterable<Uint8Array>,
): ReadableStream<Uint8Array> {
  // Use the native ReadableStream.from() if available.
  if ('from' in ReadableStream && typeof ReadableStream.from === 'function') {
    return ReadableStream.from(data)
  }

  let iterator: AsyncIterator<Uint8Array> | undefined
  return new ReadableStream({
    async pull(controller) {
      try {
        iterator ??= data[Symbol.asyncIterator]()
        const result = await iterator!.next()
        if (result.done) controller.close()
        else controller.enqueue(result.value)
      } catch (err) {
        controller.error(err)
        iterator = undefined
      }
    },
    async cancel() {
      await iterator?.return?.()
      iterator = undefined
    },
  })
}
