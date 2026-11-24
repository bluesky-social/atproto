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
