import {
  jsonStringToLex,
  LexXrpcProcedure,
  LexXrpcQuery,
  stringifyLex,
} from '@atproto/lexicon'
import {
  CallOptions,
  errorResponseBody,
  ErrorResponseBody,
  Gettable,
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

export function isErrorResponseBody(v: unknown): v is ErrorResponseBody {
  return errorResponseBody.safeParse(v).success
}

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
  const uri = new URL(constructMethodCallUrl(nsid, schema, params), serviceUri)
  return uri.toString()
}

export function constructMethodCallUrl(
  nsid: string,
  schema: LexXrpcProcedure | LexXrpcQuery,
  params?: QueryParams,
): string {
  const pathname = `/xrpc/${encodeURIComponent(nsid)}`
  if (!params) return pathname

  const searchParams: [string, string][] = []

  for (const [key, value] of Object.entries(params)) {
    const paramSchema = schema.parameters?.properties?.[key]
    if (!paramSchema) {
      throw new Error(`Invalid query parameter: ${key}`)
    }
    if (value !== undefined) {
      if (paramSchema.type === 'array') {
        const values = Array.isArray(value) ? value : [value]
        for (const val of values) {
          searchParams.push([
            key,
            encodeQueryParam(paramSchema.items.type, val),
          ])
        }
      } else {
        searchParams.push([key, encodeQueryParam(paramSchema.type, value)])
      }
    }
  }

  if (!searchParams.length) return pathname

  return `${pathname}?${new URLSearchParams(searchParams).toString()}`
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

export function constructMethodCallHeaders(
  schema: LexXrpcProcedure | LexXrpcQuery,
  data?: unknown,
  opts?: CallOptions,
): Headers {
  // Not using `new Headers(opts?.headers)` to avoid duplicating headers values
  // due to inconsistent casing in headers name. In case of multiple headers
  // with the same name (but using a different case), the last one will be used.

  // new Headers({ 'content-type': 'foo', 'Content-Type': 'bar' }).get('content-type')
  // => 'foo, bar'
  const headers = new Headers()

  if (opts?.headers) {
    for (const name in opts.headers) {
      if (headers.has(name)) {
        throw new TypeError(`Duplicate header: ${name}`)
      }

      const value = opts.headers[name]
      if (value != null) {
        headers.set(name, value)
      }
    }
  }

  if (schema.type === 'procedure') {
    if (opts?.encoding) {
      headers.set('content-type', opts.encoding)
    } else if (!headers.has('content-type') && typeof data !== 'undefined') {
      // Special handling of BodyInit types before falling back to JSON encoding
      if (
        data instanceof ArrayBuffer ||
        data instanceof ReadableStream ||
        ArrayBuffer.isView(data)
      ) {
        headers.set('content-type', 'application/octet-stream')
      } else if (data instanceof FormData) {
        // Note: The multipart form data boundary is missing from the header
        // we set here, making that header invalid. This special case will be
        // handled in encodeMethodCallBody()
        headers.set('content-type', 'multipart/form-data')
      } else if (data instanceof URLSearchParams) {
        headers.set(
          'content-type',
          'application/x-www-form-urlencoded;charset=UTF-8',
        )
      } else if (isBlobLike(data)) {
        headers.set('content-type', data.type || 'application/octet-stream')
      } else if (typeof data === 'string') {
        headers.set('content-type', 'text/plain;charset=UTF-8')
      }
      // At this point, data is not a valid BodyInit type.
      else if (isIterable(data)) {
        headers.set('content-type', 'application/octet-stream')
      } else if (
        typeof data === 'boolean' ||
        typeof data === 'number' ||
        typeof data === 'string' ||
        typeof data === 'object' // covers "null"
      ) {
        headers.set('content-type', 'application/json')
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

export function combineHeaders(
  headersInit: undefined | HeadersInit,
  defaultHeaders?: Iterable<[string, undefined | Gettable<null | string>]>,
): undefined | HeadersInit {
  if (!defaultHeaders) return headersInit

  let headers: Headers | undefined = undefined

  for (const [name, definition] of defaultHeaders) {
    // Ignore undefined values (allowed for convenience when using
    // Object.entries).
    if (definition === undefined) continue

    // Lazy initialization of the headers object
    headers ??= new Headers(headersInit)

    if (headers.has(name)) continue

    const value = typeof definition === 'function' ? definition() : definition

    if (typeof value === 'string') headers.set(name, value)
    else if (value === null) headers.delete(name)
    else throw new TypeError(`Invalid "${name}" header value: ${typeof value}`)
  }

  return headers ?? headersInit
}

function isBlobLike(value: unknown): value is Blob {
  if (value == null) return false
  if (typeof value !== 'object') return false
  if (typeof Blob === 'function' && value instanceof Blob) return true

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
    value != null &&
    typeof value === 'object' &&
    (Symbol.iterator in value || Symbol.asyncIterator in value)
  )
}

export function encodeMethodCallBody(
  headers: Headers,
  data?: unknown,
): BodyInit | undefined {
  // Silently ignore the body if there is no content-type header.
  const contentType = headers.get('content-type')
  if (!contentType) {
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
    if (data instanceof FormData && contentType === 'multipart/form-data') {
      // fetch() will encode FormData payload itself, but it won't override the
      // content-type header if already present. This would cause the boundary
      // to be missing from the content-type header, resulting in a 400 error.
      // Deleting the content-type header here to let fetch() re-create it.
      headers.delete('content-type')
    }

    // Will be encoded by the fetch API.
    return data
  }

  if (isIterable(data)) {
    // Note that some environments support using Iterable & AsyncIterable as the
    // body (e.g. Node's fetch), but not all of them do (browsers).
    return iterableToReadableStream(data)
  }

  if (contentType.startsWith('text/')) {
    return new TextEncoder().encode(String(data))
  }
  if (contentType.startsWith('application/json')) {
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
    `Unable to encode ${type} as ${contentType} data`,
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

  // If you see this error, consider using a polyfill for ReadableStream. For
  // example, the "web-streams-polyfill" package:
  // https://github.com/MattiasBuelens/web-streams-polyfill

  throw new TypeError(
    'ReadableStream.from() is not supported in this environment. ' +
      'It is required to support using iterables as the request body. ' +
      'Consider using a polyfill or re-write your code to use a different body type.',
  )
}

export function httpResponseBodyParse(
  mimeType: string | null,
  data: ArrayBuffer | undefined,
): any {
  try {
    if (mimeType) {
      if (mimeType.includes('application/json')) {
        const str = new TextDecoder().decode(data)
        return jsonStringToLex(str)
      }
      if (mimeType.startsWith('text/')) {
        return new TextDecoder().decode(data)
      }
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data)
    }
    return data
  } catch (cause) {
    throw new XRPCError(
      ResponseType.InvalidResponse,
      undefined,
      `Failed to parse response body: ${String(cause)}`,
      undefined,
      { cause },
    )
  }
}
