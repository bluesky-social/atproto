import {
  methodSchema,
  MethodSchema,
  isValidMethodSchema,
} from '@atproto/lexicon'
import {
  getMethodSchemaHTTPMethod,
  constructMethodCallUri,
  constructMethodCallHeaders,
  encodeMethodCallBody,
  httpResponseCodeToEnum,
  httpResponseBodyParse,
} from './util'
import {
  FetchHandler,
  FetchHandlerResponse,
  Headers,
  CallOptions,
  QueryParams,
  ResponseType,
  errorResponseBody,
  ErrorResponseBody,
  XRPCResponse,
  XRPCError,
} from './types'

export class Client {
  fetch: FetchHandler = defaultFetchHandler
  schemas: Map<string, MethodSchema> = new Map()

  // method calls
  //

  async call(
    serviceUri: string | URL,
    methodNsid: string,
    params?: QueryParams,
    data?: any,
    opts?: CallOptions,
  ) {
    return this.service(serviceUri).call(methodNsid, params, data, opts)
  }

  service(serviceUri: string | URL) {
    return new ServiceClient(this, serviceUri)
  }

  // schemas
  // =

  addSchema(schema: unknown) {
    if (isValidMethodSchema(schema)) {
      this.schemas.set(schema.id, schema)
    } else {
      methodSchema.parse(schema) // will throw with the validation error
    }
  }

  addSchemas(schemas: unknown[]) {
    for (const schema of schemas) {
      this.addSchema(schema)
    }
  }

  listSchemaIds(): string[] {
    return Array.from(this.schemas.keys())
  }

  removeSchema(nsid: string) {
    this.schemas.delete(nsid)
  }
}

export class ServiceClient {
  baseClient: Client
  uri: URL
  headers: Record<string, string> = {}

  constructor(baseClient: Client, serviceUri: string | URL) {
    this.baseClient = baseClient
    this.uri = typeof serviceUri === 'string' ? new URL(serviceUri) : serviceUri
  }

  setHeader(key: string, value: string): void {
    this.headers[key] = value
  }

  async call(
    methodNsid: string,
    params?: QueryParams,
    data?: any,
    opts?: CallOptions,
  ) {
    const schema = this.baseClient.schemas.get(methodNsid)
    if (!schema) {
      throw new Error(`Method schema not found: ${methodNsid}`)
    }
    const httpMethod = getMethodSchemaHTTPMethod(schema)
    const httpUri = constructMethodCallUri(schema, this.uri, params)
    const httpHeaders = constructMethodCallHeaders(schema, data, {
      headers: {
        ...this.headers,
        ...opts?.headers,
      },
      encoding: opts?.encoding,
    })

    const res = await this.baseClient.fetch(
      httpUri,
      httpMethod,
      httpHeaders,
      data,
    )

    const resCode = httpResponseCodeToEnum(res.status)
    if (resCode === ResponseType.Success) {
      return new XRPCResponse(res.body, res.headers)
    } else {
      if (res.body && isErrorResponseBody(res.body)) {
        throw new XRPCError(resCode, res.body.error, res.body.message)
      } else {
        throw new XRPCError(resCode)
      }
    }
  }
}

async function defaultFetchHandler(
  httpUri: string,
  httpMethod: string,
  httpHeaders: Headers,
  httpReqBody: any,
): Promise<FetchHandlerResponse> {
  try {
    const res = await fetch(httpUri, {
      method: httpMethod,
      headers: httpHeaders,
      body: encodeMethodCallBody(httpHeaders, httpReqBody),
    })
    const resBody = await res.arrayBuffer()
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: httpResponseBodyParse(res.headers.get('content-type'), resBody),
    }
  } catch (e: any) {
    throw new XRPCError(ResponseType.Unknown, e.toString())
  }
}

function isErrorResponseBody(v: unknown): v is ErrorResponseBody {
  return errorResponseBody.safeParse(v).success
}
