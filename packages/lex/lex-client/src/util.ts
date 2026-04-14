import type { DidString, Service } from './types.js'

export function applyDefaults<
  TDefaults extends Record<string, unknown>,
  TOptions extends {
    [K in keyof TDefaults]?: TDefaults[K]
  },
>(options: TOptions, defaults: TDefaults): TOptions & TDefaults {
  const combined: Partial<TDefaults> = { ...options }

  // @NOTE We make sure that options with an explicit `undefined` value get the
  // default, since spreading doesn't override with `undefined`.
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    if (options[key] === undefined) {
      combined[key] = defaults[key]
    }
  }

  return combined as TOptions & TDefaults
}

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

export type XrpcRequestHeadersOptions = {
  /** Additional HTTP headers to include in the request. */
  headers?: HeadersInit

  /** Labeler DIDs to request labels from for content moderation. */
  labelers?: Iterable<DidString>

  /** Service proxy identifier for routing requests through a specific service. */
  service?: Service
}

/**
 * Builds HTTP headers for AT Protocol requests.
 *
 * Adds the following headers when applicable:
 * - `atproto-proxy`: Service routing header (if service is specified)
 * - `atproto-accept-labelers`: Comma-separated list of labeler DIDs
 *
 * @see {@link XrpcRequestHeadersOptions}
 * @returns A new Headers object with AT Protocol headers added
 */
export function buildXrpcRequestHeaders(
  options: XrpcRequestHeadersOptions,
): Headers {
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

  /* v8 ignore next -- @preserve */
  if ('from' in ReadableStream && typeof ReadableStream.from === 'function') {
    return ReadableStream.from(data)
  }

  /* v8 ignore next -- @preserve */
  return toReadableStreamPonyfill(data)
}

export function toReadableStreamPonyfill(
  data: AsyncIterable<Uint8Array>,
): ReadableStream<Uint8Array> {
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
