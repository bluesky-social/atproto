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
          const vals: typeof value[] = []
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

export function normalizeHeaders(headers: Headers): Headers {
  const normalized: Headers = {}
  for (const [header, value] of Object.entries(headers)) {
    normalized[header.toLowerCase()] = value
  }

  return normalized
}

export function constructMethodCallHeaders(
  schema: LexXrpcProcedure | LexXrpcQuery,
  data?: any,
  opts?: CallOptions,
): Headers {
  const headers: Headers = opts?.headers || {}
  if (schema.type === 'procedure') {
    if (opts?.encoding) {
      headers['Content-Type'] = opts.encoding
    }
    if (data && typeof data === 'object') {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }
    }
  }
  return headers
}

export function encodeMethodCallBody(
  headers: Headers,
  data?: any,
): ArrayBuffer | undefined {
  if (!headers['content-type'] || typeof data === 'undefined') {
    return undefined
  }
  if (data instanceof ArrayBuffer) {
    return data
  }
  if (headers['content-type'].startsWith('text/')) {
    return new TextEncoder().encode(data.toString())
  }
  if (headers['content-type'].startsWith('application/json')) {
    return new TextEncoder().encode(stringifyLex(data))
  }
  return data
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
