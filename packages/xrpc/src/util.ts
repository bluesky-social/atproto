import {
  jsonStringToLex,
  LexXrpcProcedure,
  LexXrpcQuery,
  stringifyLex,
} from '@atproto/lexicon'
import {
  CallOptions,
  Headers,
  QueryParams,
  ResponseType,
  XRPCError,
} from './types'

const ReadableStream =
  globalThis.ReadableStream ||
  (class {
    constructor() {
      // This anonymous class will never pass any "instanceof" check and cannot
      // be instantiated.
      throw new Error('ReadableStream is not supported in this environment')
    }
  } as typeof globalThis.ReadableStream)

export function getMethodSchemaHTTPMethod(
  schema: LexXrpcProcedure | LexXrpcQuery,
) {
  if (schema.type === 'procedure') {
    return 'post'
  }
  return 'get'
}

export function constructMethodCallUri(
  nsid: string,
  schema: LexXrpcProcedure | LexXrpcQuery,
  serviceUri: URL,
  params?: QueryParams,
): string {
  const uri = new URL(serviceUri)
  uri.pathname = `/xrpc/${nsid}`

  // given parameters
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const paramSchema = schema.parameters?.properties?.[key]
      if (!paramSchema) {
        throw new Error(`Invalid query parameter: ${key}`)
      }
      if (value !== undefined) {
        if (paramSchema.type === 'array') {
          const vals: (typeof value)[] = []
          vals.concat(value).forEach((val) => {
            uri.searchParams.append(
              key,
              encodeQueryParam(paramSchema.items.type, val),
            )
          })
        } else {
          uri.searchParams.set(key, encodeQueryParam(paramSchema.type, value))
        }
      }
    }
  }

  return uri.toString()
}

export function encodeQueryParam(
  type:
    | 'string'
    | 'float'
    | 'integer'
    | 'boolean'
    | 'datetime'
    | 'array'
    | 'unknown',
  value: any,
): string {
  if (type === 'string' || type === 'unknown') {
    return String(value)
  }
  if (type === 'float') {
    return String(Number(value))
  } else if (type === 'integer') {
    return String(Number(value) | 0)
  } else if (type === 'boolean') {
    return value ? 'true' : 'false'
  } else if (type === 'datetime') {
    if (value instanceof Date) {
      return value.toISOString()
    }
    return String(value)
  }
  throw new Error(`Unsupported query param type: ${type}`)
}

function normalizeHeaders(headers: Headers): Headers {
  const normalized: Headers = {}
  for (const [header, value] of Object.entries(headers)) {
    normalized[header.toLowerCase()] = value
  }

  return normalized
}

export function constructMethodCallHeaders(
  schema: LexXrpcProcedure | LexXrpcQuery,
  data?: unknown,
  opts?: CallOptions,
): Headers {
  const headers: Headers = opts?.headers ? normalizeHeaders(opts.headers) : {}
  if (schema.type === 'procedure') {
    if (opts?.encoding) {
      headers['content-type'] = opts.encoding
    } else if (!headers['content-type'] && typeof data !== 'undefined') {
      // Special handling of BodyInit types before falling back to JSON encoding
      if (
        data instanceof ArrayBuffer ||
        data instanceof ReadableStream ||
        ArrayBuffer.isView(data)
      ) {
        headers['content-type'] = 'application/octet-stream'
      } else if (data instanceof FormData) {
        // Note: The multipart form data boundary is missing from the header
        // we set here, making that header invalid. This special case will be
        // handled in encodeMethodCallBody()
        headers['content-type'] = 'multipart/form-data'
      } else if (data instanceof URLSearchParams) {
        headers['content-type'] =
          'application/x-www-form-urlencoded;charset=UTF-8'
      } else if (isBlobLike(data)) {
        headers['content-type'] = data.type || 'application/octet-stream'
      } else if (typeof data === 'string') {
        headers['content-type'] = 'text/plain;charset=UTF-8'
      }
      // At this point, data is not a valid BodyInit type.
      else if (isIterable(data)) {
        headers['content-type'] = 'application/octet-stream'
      } else if (
        typeof data === 'boolean' ||
        typeof data === 'number' ||
        typeof data === 'string' ||
        typeof data === 'object'
      ) {
        headers['content-type'] = 'application/json'
      } else {
        // symbol, function, bigint
        throw new XRPCError(
          ResponseType.InvalidRequest,
          `Unsupported data type: ${typeof data}`,
        )
      }
    }
  }
  return headers
}

function isBlobLike(value: unknown): value is Blob {
  if (value == null) return false
  if (typeof value !== 'object') return false
  if (value instanceof Blob) return true

  // Support for Blobs provided by libraries that don't use the native Blob
  // (e.g. fetch-blob from node-fetch).
  // https://github.com/node-fetch/fetch-blob/blob/a1a182e5978811407bef4ea1632b517567dda01f/index.js#L233-L244

  const tag = value[Symbol.toStringTag]
  if (tag === 'Blob' || tag === 'File') {
    return 'stream' in value && typeof value.stream === 'function'
  }

  return false
}

export function isBodyInit(value: unknown): value is BodyInit {
  switch (typeof value) {
    case 'string':
      return true
    case 'object':
      return (
        value instanceof ArrayBuffer ||
        value instanceof FormData ||
        value instanceof URLSearchParams ||
        value instanceof ReadableStream ||
        ArrayBuffer.isView(value) ||
        isBlobLike(value)
      )
    default:
      return false
  }
}

export function isIterable(
  value: unknown,
): value is Iterable<unknown> | AsyncIterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Symbol.iterator in value || Symbol.asyncIterator in value)
  )
}

export function encodeMethodCallBody(
  headers: Headers,
  data?: unknown,
): BodyInit | undefined {
  // Silently ignore the body if there is no content-type header.
  if (!headers['content-type']) {
    return undefined
  }

  if (typeof data === 'undefined') {
    // This error would be returned by the server, but we can catch it earlier
    // to avoid un-necessary requests. Note that a content-length of 0 does not
    // necessary mean that the body is "empty" (e.g. an empty txt file).
    throw new XRPCError(
      ResponseType.InvalidRequest,
      `A request body is expected but none was provided`,
    )
  }

  if (isBodyInit(data)) {
    if (data instanceof FormData) {
      // fetch() will encode FormData payload itself, but it won't override the
      // content-type header if already present. This would cause the boundary
      // to be missing from the content-type header, resulting in a 400 error.
      // Deleting the content-type header here to let fetch() re-create it.
      delete headers['content-type']
    }

    // Will be encoded by the fetch API.
    return data
  }

  if (isIterable(data)) {
    // Note that some environments support using Iterable & AsyncIterable as the
    // body (e.g. Node's fetch), but not all of them do (browsers).
    return iterableToReadableStream(data)
  }

  if (headers['content-type'].startsWith('text/')) {
    return new TextEncoder().encode(String(data))
  }
  if (headers['content-type'].startsWith('application/json')) {
    const json = stringifyLex(data)
    // Server would return a 400 error if the JSON is invalid (e.g. trying to
    // JSONify a function, or an object that implements toJSON() poorly).
    if (json === undefined) {
      throw new XRPCError(
        ResponseType.InvalidRequest,
        `Failed to encode request body as JSON`,
      )
    }
    return new TextEncoder().encode(json)
  }

  // At this point, "data" is not a valid BodyInit value, and we don't know how
  // to encode it into one. Passing it to fetch would result in an error. Let's
  // throw our own error instead.

  const type =
    !data || typeof data !== 'object'
      ? typeof data
      : data.constructor !== Object &&
          typeof data.constructor === 'function' &&
          typeof data.constructor?.name === 'string'
        ? data.constructor.name
        : 'object'

  throw new XRPCError(
    ResponseType.InvalidRequest,
    `Unable to encode ${type} as ${headers['content-type']} data`,
  )
}

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/from_static}
 */
function iterableToReadableStream(
  iterable: Iterable<unknown> | AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
  // Use the native ReadableStream.from() if available.
  if ('from' in ReadableStream && typeof ReadableStream.from === 'function') {
    return ReadableStream.from(iterable)
  }

  // Note, in environments where ReadableStream is not available either, we
  // *could* load the iterable into memory and create an Arraybuffer from it.
  // However, this would be a bad idea for large iterables. In order to keep
  // things simple, we'll just allow the anonymous ReadableStream constructor
  // to throw an error in those environments, hinting the user of the lib to find
  // an alternate solution in that case (e.g. use a Blob if available).

  let generator: AsyncGenerator<unknown, void, undefined>
  return new ReadableStream<Uint8Array>({
    type: 'bytes',
    start() {
      // Wrap the iterable in an async generator to handle both sync and async
      // iterables, and make sure that the return() method exists.
      generator = (async function* () {
        yield* iterable
      })()
    },
    async pull(controller: ReadableStreamDefaultController) {
      const { done, value } = await generator.next()
      if (done) {
        controller.close()
      } else {
        try {
          const buf = toUint8Array(value)
          if (buf) controller.enqueue(buf)
        } catch (cause) {
          // ReadableStream won't call cancel() if the stream is errored.
          await generator.return()

          controller.error(
            new TypeError(
              'Converting iterable body to ReadableStream requires Buffer, ArrayBuffer or string values',
              { cause },
            ),
          )
        }
      }
    },
    async cancel() {
      await generator.return()
    },
  })
}

// Browsers don't have Buffer. This syntax is to avoid bundlers from including
// Buffer in the bundle if it's not used elsewhere.
const globalName = `${{ toString: () => 'Buf' }}fer` as 'Buffer'
const Buffer =
  typeof globalThis[globalName] === 'function'
    ? globalThis[globalName]
    : undefined

const toUint8Array: (value: unknown) => Uint8Array | undefined = Buffer
  ? (value) => {
      // @ts-expect-error Buffer.from will throw if value is not a valid input
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value)
      return buf.byteLength ? new Uint8Array(buf) : undefined
    }
  : (value) => {
      if (value instanceof ArrayBuffer) {
        const buf = new Uint8Array(value)
        return buf.byteLength ? buf : undefined
      }

      // Simulate Buffer.from() behavior for strings and and coercion
      if (typeof value === 'string') {
        return value.length ? new TextEncoder().encode(value) : undefined
      } else if (typeof value?.valueOf === 'function') {
        const coerced = value.valueOf()
        if (coerced instanceof ArrayBuffer) {
          const buf = new Uint8Array(coerced)
          return buf.byteLength ? buf : undefined
        } else if (typeof coerced === 'string') {
          return coerced.length ? new TextEncoder().encode(coerced) : undefined
        }
      }

      throw new TypeError(`Unsupported value type: ${typeof value}`)
    }

export function httpResponseCodeToEnum(status: number): ResponseType {
  let resCode: ResponseType
  if (status in ResponseType) {
    resCode = status
  } else if (status >= 100 && status < 200) {
    resCode = ResponseType.XRPCNotSupported
  } else if (status >= 200 && status < 300) {
    resCode = ResponseType.Success
  } else if (status >= 300 && status < 400) {
    resCode = ResponseType.XRPCNotSupported
  } else if (status >= 400 && status < 500) {
    resCode = ResponseType.InvalidRequest
  } else {
    resCode = ResponseType.InternalServerError
  }
  return resCode
}

export function httpResponseBodyParse(
  mimeType: string | null,
  data: ArrayBuffer | undefined,
): any {
  if (mimeType) {
    if (mimeType.includes('application/json') && data?.byteLength) {
      try {
        const str = new TextDecoder().decode(data)
        return jsonStringToLex(str)
      } catch (e) {
        throw new XRPCError(
          ResponseType.InvalidResponse,
          `Failed to parse response body: ${String(e)}`,
        )
      }
    }
    if (mimeType.startsWith('text/') && data?.byteLength) {
      try {
        return new TextDecoder().decode(data)
      } catch (e) {
        throw new XRPCError(
          ResponseType.InvalidResponse,
          `Failed to parse response body: ${String(e)}`,
        )
      }
    }
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  return data
}
