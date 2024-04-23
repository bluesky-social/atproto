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
  Headers,
  QueryParams,
  ResponseType,
  XRPCError,
} from './types'

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
    } else if (!headers['content-type']) {
      if (data instanceof URLSearchParams || data instanceof FormData) {
        // This can be worked around by setting the "encoding" option or
        // "content-type" header, or by using a blob.
        const className = data.constructor?.name ?? 'FormData'
        throw new TypeError(`XRPC does not allow ${className} as request body`)
      } else if (
        data instanceof ReadableStream ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data)
      ) {
        const className = data.constructor?.name ?? 'Object'
        throw new TypeError(
          `Usage of ${className} as request body requires setting the "encoding" option`,
        )
      } else if (data instanceof Blob) {
        if (!data.type) {
          throw new TypeError('Blob requires a MIME type')
        }
        headers['content-type'] = data.type
      } else if (typeof data === 'object' && data !== null) {
        // All other object BodyInit types have been ruled out, so this must be JSON
        headers['content-type'] = 'application/json'
      }
    }
  }
  return headers
}

export function encodeMethodCallBody(
  headers: Headers,
  data?: unknown,
): BodyInit | undefined {
  if (!headers['content-type'] || typeof data === 'undefined') {
    return undefined
  }

  if (
    data instanceof URLSearchParams ||
    data instanceof FormData ||
    data instanceof Blob ||
    data instanceof ReadableStream ||
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data)
  ) {
    return data
  }
  if (headers['content-type'].startsWith('text/')) {
    return new TextEncoder().encode(String(data))
  }
  if (headers['content-type'].startsWith('application/json')) {
    return new TextEncoder().encode(stringifyLex(data))
  }
  if (data === null) {
    // After json so that null can be encoded as "null" json string.
    return undefined
  }
  throw new TypeError(`Unsupported content-type: ${headers['content-type']}`)
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
