import axios from 'axios'
import {
  getMethodSchemaHTTPMethod,
  constructMethodCallUri,
  constructMethodCallHeaders,
  httpResponseCodeToEnum,
  httpResponseBodyParse,
} from './util'
import {
  methodSchema,
  MethodSchema,
  isValidMethodSchema,
  CallOptions,
  QueryParams,
  ResponseType,
  errorResponseBody,
  ErrorResponseBody,
  XRPCResponse,
  XRPCError,
} from './types'

export class Client {
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

  constructor(baseClient: Client, serviceUri: string | URL) {
    this.baseClient = baseClient
    this.uri = typeof serviceUri === 'string' ? new URL(serviceUri) : serviceUri
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
    const httpHeaders = constructMethodCallHeaders(schema, data, opts)

    let res
    try {
      res = await axios({
        method: httpMethod,
        url: httpUri,
        headers: httpHeaders,
        data,
        responseType: 'arraybuffer',
      })
    } catch (e: any) {
      if (e.response) {
        res = e.response
      } else {
        throw new XRPCError(ResponseType.Unknown, e.toString())
      }
    }

    const resCode = httpResponseCodeToEnum(res.status)
    const jsonOut = httpResponseBodyParse(res.headers['content-type'], res.data)
    if (resCode === ResponseType.Success) {
      return new XRPCResponse(jsonOut || res.data, res.headers)
    } else {
      if (jsonOut && isErrorResponseBody(jsonOut)) {
        throw new XRPCError(resCode, jsonOut.message)
      } else {
        throw new XRPCError(resCode)
      }
    }
  }
}

function isErrorResponseBody(v: unknown): v is ErrorResponseBody {
  return errorResponseBody.safeParse(v).success
}
