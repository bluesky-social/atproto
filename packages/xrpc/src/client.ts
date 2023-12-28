import { LexiconDoc, Lexicons, ValidationError } from '@atproto/lexicon'
import {
  getMethodSchemaHTTPMethod,
  constructMethodCallUri,
  constructMethodCallHeaders,
  encodeMethodCallBody,
  httpResponseCodeToEnum,
  httpResponseBodyParse,
  normalizeHeaders,
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
  XRPCInvalidResponseError,
} from './types'

export class Client {
  fetch: FetchHandler = defaultFetchHandler
  lex = new Lexicons()

  // method calls
  //

  async call(
    serviceUri: string | URL,
    methodNsid: string,
    params?: QueryParams,
    data?: unknown,
    opts?: CallOptions,
  ) {
    return this.service(serviceUri).call(methodNsid, params, data, opts)
  }

  service(serviceUri: string | URL) {
    return new ServiceClient(this, serviceUri)
  }

  // schemas
  // =

  addLexicon(doc: LexiconDoc) {
    this.lex.add(doc)
  }

  addLexicons(docs: LexiconDoc[]) {
    for (const doc of docs) {
      this.addLexicon(doc)
    }
  }

  removeLexicon(uri: string) {
    this.lex.remove(uri)
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

  unsetHeader(key: string): void {
    delete this.headers[key]
  }

  async call(
    methodNsid: string,
    params?: QueryParams,
    data?: unknown,
    opts?: CallOptions,
  ) {
    const def = this.baseClient.lex.getDefOrThrow(methodNsid)
    if (!def || (def.type !== 'query' && def.type !== 'procedure')) {
      throw new Error(
        `Invalid lexicon: ${methodNsid}. Must be a query or procedure.`,
      )
    }

    const httpMethod = getMethodSchemaHTTPMethod(def)
    const httpUri = constructMethodCallUri(methodNsid, def, this.uri, params)
    const httpHeaders = constructMethodCallHeaders(def, data, {
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
      try {
        this.baseClient.lex.assertValidXrpcOutput(methodNsid, res.body)
      } catch (e: any) {
        if (e instanceof ValidationError) {
          throw new XRPCInvalidResponseError(methodNsid, e, res.body)
        } else {
          throw e
        }
      }
      return new XRPCResponse(res.body, res.headers)
    } else {
      if (res.body && isErrorResponseBody(res.body)) {
        throw new XRPCError(
          resCode,
          res.body.error,
          res.body.message,
          res.headers,
        )
      } else {
        throw new XRPCError(resCode)
      }
    }
  }
}

export async function defaultFetchHandler(
  httpUri: string,
  httpMethod: string,
  httpHeaders: Headers,
  httpReqBody: unknown,
): Promise<FetchHandlerResponse> {
  try {
    // The duplex field is now required for streaming bodies, but not yet reflected
    // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
    const headers = normalizeHeaders(httpHeaders)
    const reqInit: RequestInit & { duplex: string } = {
      method: httpMethod,
      headers,
      body: encodeMethodCallBody(headers, httpReqBody),
      duplex: 'half',
    }
    const res = await fetch(httpUri, reqInit)
    const resBody = await res.arrayBuffer()
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: httpResponseBodyParse(res.headers.get('content-type'), resBody),
    }
  } catch (e) {
    throw new XRPCError(ResponseType.Unknown, String(e))
  }
}

function isErrorResponseBody(v: unknown): v is ErrorResponseBody {
  return errorResponseBody.safeParse(v).success
}
