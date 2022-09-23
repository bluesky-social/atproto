import { MethodSchema } from '@adxp/lexicon'
import {
  CallOptions,
  Headers,
  QueryParams,
  ResponseType,
  XRPCError,
} from './types'

export function getMethodSchemaHTTPMethod(schema: MethodSchema) {
  if (schema.type === 'query') {
    return 'get'
  }
  if (schema.type === 'procedure') {
    return 'post'
  }
  throw new Error(`Invalid method type: ${schema.type}`)
}

export function constructMethodCallUri(
  schema: MethodSchema,
  serviceUri: URL,
  params?: QueryParams,
): string {
  const uri = new URL(serviceUri)
  uri.pathname = `/xrpc/${schema.id}`

  // default parameters
  if (schema.parameters) {
    for (const [key, paramSchema] of Object.entries(schema.parameters)) {
      if (paramSchema.default) {
        uri.searchParams.set(
          key,
          encodeQueryParam(paramSchema.type, paramSchema.default),
        )
      }
    }
  }

  // given parameters
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const paramSchema = schema.parameters?.[key]
      if (!paramSchema) {
        throw new Error(`Invalid query parameter: ${key}`)
      }
      uri.searchParams.set(key, encodeQueryParam(paramSchema.type, value))
    }
  }

  return uri.toString()
}

export function encodeQueryParam(
  type: 'string' | 'number' | 'integer' | 'boolean',
  value: any,
): string {
  if (type === 'string') {
    return String(value)
  }
  if (type === 'number') {
    return String(Number(value))
  } else if (type === 'integer') {
    return String(Number(value) | 0)
  } else if (type === 'boolean') {
    return value ? 'true' : 'false'
  }
  throw new Error(`Unsupported query param type: ${type}`)
}

export function constructMethodCallHeaders(
  schema: MethodSchema,
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
  if (!headers['Content-Type'] || typeof data === 'undefined') {
    return undefined
  }
  if (data instanceof ArrayBuffer) {
    return data
  }
  if (headers['Content-Type'].startsWith('text/')) {
    return new TextEncoder().encode(data.toString())
  }
  if (headers['Content-Type'].startsWith('application/json')) {
    return new TextEncoder().encode(JSON.stringify(data))
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
        return JSON.parse(str)
      } catch (e: any) {
        throw new XRPCError(
          ResponseType.InvalidResponse,
          `Failed to parse response body: ${e.toString()}`,
        )
      }
    }
    if (mimeType.startsWith('text/') && data?.byteLength) {
      try {
        return new TextDecoder().decode(data)
      } catch (e: any) {
        throw new XRPCError(
          ResponseType.InvalidResponse,
          `Failed to parse response body: ${e.toString()}`,
        )
      }
    }
  }
  return data
}
