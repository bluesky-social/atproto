import type {
  InferRecordKey,
  LexiconRecordKey,
  RecordSchema,
} from '@atproto/lex-schema'
import type { DidString, Service } from './types.ts'

type NonReadonly<T> = { -readonly [K in keyof T]: T[K] }

export type WithDefaults<
  TOptions extends Record<string, unknown>,
  TDefaults extends Record<string, unknown>[],
> = TDefaults extends [infer First, ...infer Rest extends any[]]
  ? TOptions & WithDefaults<NonReadonly<First>, Rest>
  : TOptions

export function applyDefaults<
  TOptions extends Readonly<Record<string, unknown>>,
  TDefaults extends Readonly<Record<string, unknown>>[],
>(
  options: TOptions,
  ...defaults: TDefaults
): WithDefaults<TOptions, TDefaults> {
  const combined: Record<string, unknown> = { ...options }

  // @NOTE We make sure that options with an explicit `undefined` value get the
  // default, since spreading doesn't override with `undefined`. When multiple
  // defaults define the same key, the first defined value wins.
  for (const def of defaults) {
    for (const key of Object.keys(def) as (keyof typeof def)[]) {
      if (combined[key] === undefined) {
        combined[key] = def[key]
      }
    }
  }

  return combined as WithDefaults<TOptions, TDefaults>
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

export function asUint8ArrayArrayBuffer(
  bytes: Uint8Array,
): Uint8Array<ArrayBuffer> {
  // If the Uint8Array is already backed by a non-shared ArrayBuffer, we can use
  // it directly.
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes as Uint8Array<ArrayBuffer>
  }

  // Otherwise, we need to create a new ArrayBuffer and copy the data.
  return new Uint8Array(bytes)
}

export type XrpcRequestHeadersOptions = {
  /**
   * Additional custom HTTP headers to include in the request.
   *
   * @note "atproto-proxy" and "atproto-accept-labelers" headers might change
   * depending on the `service` and `labelers` options, respectively, if they
   * are provided (which is always the case when using {@link Client.xrpc}).
   */
  headers?: HeadersInit

  /**
   * Labeler DIDs to request labels from for content moderation.
   *
   * When `undefined`, will default to the client instance's default. When
   * `null`, it will cause any existing `atproto-accept-labelers` header
   * (including one provided through the
   * {@link XrpcRequestHeadersOptions.headers} option) to be removed.
   */
  labelers?: null | Iterable<DidString>

  /**
   * Labeler DIDs to request labels from for content moderation. Values here
   * will always be applied with the ";redact" suffix, which indicates that the
   * client is requesting that the labeler redact content that is deemed
   * inappropriate.
   */
  appLabelers?: null | Iterable<DidString>

  /**
   * Service proxy identifier for routing requests through a specific service.
   *
   * When `undefined`, will default to the client instance's default. When not
   * used against a client instance (e.g., when using the {@link xrpc} helper
   * function), the default is to not alter the `atproto-proxy` header (e.g. if
   * one is provided in the {@link XrpcRequestHeadersOptions.headers}).
   *
   * When defined (as either `null` or a string), it will override any
   * `atproto-proxy` header provided in the
   * {@link XrpcRequestHeadersOptions.headers} option.
   */
  service?: null | Service
}

/**
 * Builds HTTP headers for AT Protocol requests.
 *
 * Adds or removes the following headers based on the provided options:
 * - `atproto-proxy`: Service routing header (if service is specified)
 * - `atproto-accept-labelers`: Comma-separated list of labeler DIDs
 *
 * @see {@link XrpcRequestHeadersOptions}
 * @returns A new Headers object with AT Protocol headers added
 */
export function buildXrpcRequestHeaders({
  service,
  labelers,
  appLabelers,
  headers: headersInit,
}: XrpcRequestHeadersOptions): Headers {
  const headers = new Headers(headersInit)

  // If provided, the "service" option overrides any existing "atproto-proxy"
  // header. If `null`, the header is removed entirely.
  if (service !== undefined) {
    if (service === null) {
      headers.delete('atproto-proxy')
    } else {
      headers.set('atproto-proxy', service)
    }
  }

  // Labelers are combined from the "appLabelers" and "labelers" options, as
  // well as any existing "atproto-accept-labelers" header. The "appLabelers"
  // are always added with the ";redact" suffix, while the "labelers" are added
  // as-is. Existing labelers headers are not preserved if the "labelers" option
  // is explicitly set to null.
  const combinedLabelers = new Set<string>()

  if (appLabelers) {
    for (const labeler of appLabelers) {
      combinedLabelers.add(`${labeler};redact`)
    }
  }

  if (labelers) {
    for (const labeler of labelers) {
      combinedLabelers.add(labeler)
    }
  }

  if (labelers !== null) {
    const headersLabelers = headers.get('atproto-accept-labelers')
    if (headersLabelers) {
      for (const labeler of headersLabelers
        .split(',')
        .map(trim)
        .filter(Boolean)) {
        if (labeler) combinedLabelers.add(labeler)
      }
    }
  }

  if (combinedLabelers.size > 0) {
    headers.set(
      'atproto-accept-labelers',
      Array.from(combinedLabelers).join(', '),
    )
  } else {
    headers.delete('atproto-accept-labelers')
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
  return new ReadableStream<Uint8Array>({
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

export type RecordKeyOptions<
  T extends RecordSchema,
  AlsoOptionalWhenRecordKeyIs extends LexiconRecordKey = never,
> = T['key'] extends `literal:${string}` | AlsoOptionalWhenRecordKeyIs
  ? { rkey?: InferRecordKey<T> }
  : { rkey: InferRecordKey<T> }

export function getDefaultRecordKey<const T extends RecordSchema>(
  schema: T,
): undefined | InferRecordKey<T> {
  // Let the server generate the TID
  if (schema.key === 'tid') return undefined
  if (schema.key === 'any') return undefined

  return getLiteralRecordKey(schema)
}

export function getLiteralRecordKey<const T extends RecordSchema>(
  schema: T,
): InferRecordKey<T> {
  if (schema.key.startsWith('literal:')) {
    return schema.key.slice(8) as InferRecordKey<T>
  }

  throw new TypeError(
    `An "rkey" must be provided for record key type "${schema.key}" (${schema.$type})`,
  )
}

export function mergeHeaders(
  defaultHeaders: HeadersInit,
  requestHeaders: HeadersInit,
): Headers {
  // We don't want to alter the original Headers objects, so we create a new one
  const result = new Headers(defaultHeaders)

  const overrides =
    requestHeaders instanceof Headers
      ? requestHeaders
      : new Headers(requestHeaders)

  for (const [key, value] of overrides.entries()) {
    result.set(key, value)
  }

  return result
}

export function wait(
  ms: number,
  { signal }: { signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted()

    const cleanup = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      cleanup()
      reject(
        // @NOTE the signal exists, and the reason should be set at this point.
        signal?.reason ??
          // React Native does not have DOMException
          (typeof DOMException !== 'undefined'
            ? new DOMException('Aborted', 'AbortError')
            : new Error('Aborted')),
      )
    }

    signal?.addEventListener('abort', onAbort)
  })
}

export function trim(value: string): string {
  return value.trim()
}
