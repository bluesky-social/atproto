import { LexiconDoc, Lexicons, ValidationError } from '@atproto/lexicon'
import {
  FetchHandler,
  FetchHandlerOptions,
  buildFetchHandler,
} from './fetch-handler'
import {
  CallOptions,
  HeaderGetter,
  QueryParams,
  ResponseType,
  XRPCError,
  XRPCInvalidResponseError,
  XRPCResponse,
  httpResponseCodeToEnum,
} from './types'
import {
  combineHeaders,
  constructMethodCallHeaders,
  constructMethodCallUrl,
  encodeMethodCallBody,
  getMethodSchemaHTTPMethod,
  httpResponseBodyParse,
  isErrorResponseBody,
} from './util'

export class XrpcClient {
  readonly fetchHandler: FetchHandler
  readonly lex: Lexicons

  protected headers = new Map<string, HeaderGetter>()

  constructor(
    fetchHandler: FetchHandler | FetchHandlerOptions,
    lex: Lexicons | Iterable<LexiconDoc>,
  ) {
    this.fetchHandler =
      typeof fetchHandler === 'function'
        ? fetchHandler
        : buildFetchHandler(fetchHandler)

    this.lex = lex instanceof Lexicons ? lex : new Lexicons(lex)
  }

  setHeader(key: string, value: HeaderGetter): void {
    this.headers.set(key.toLowerCase(), value)
  }

  unsetHeader(key: string): void {
    this.headers.delete(key.toLowerCase())
  }

  async call(
    methodNsid: string,
    params?: QueryParams,
    data?: unknown,
    opts?: CallOptions,
  ): Promise<XRPCResponse> {
    const def = this.lex.getDefOrThrow(methodNsid)
    if (!def || (def.type !== 'query' && def.type !== 'procedure')) {
      throw new TypeError(
        `Invalid lexicon: ${methodNsid}. Must be a query or procedure.`,
      )
    }

    const reqUrl = constructMethodCallUrl(methodNsid, def, params)
    const reqMethod = getMethodSchemaHTTPMethod(def)
    const reqHeaders = constructMethodCallHeaders(def, data, opts)
    const reqBody = encodeMethodCallBody(reqHeaders, data)

    // The duplex field is required for streaming bodies, but not yet reflected
    // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
    const init: RequestInit & { duplex: 'half' } = {
      method: reqMethod,
      headers: await combineHeaders(reqHeaders, this.headers),
      body: reqBody,
      duplex: 'half',
      signal: opts?.signal,
    }

    try {
      const response = await this.fetchHandler.call(undefined, reqUrl, init)

      const resStatus = response.status
      const resHeaders = Object.fromEntries(response.headers.entries())
      const resBodyBytes = await response.arrayBuffer()
      const resBody = httpResponseBodyParse(
        response.headers.get('content-type'),
        resBodyBytes,
      )

      const resCode = httpResponseCodeToEnum(resStatus)
      if (resCode !== ResponseType.Success) {
        const { error = undefined, message = undefined } =
          resBody && isErrorResponseBody(resBody) ? resBody : {}
        throw new XRPCError(resCode, error, message, resHeaders)
      }

      try {
        this.lex.assertValidXrpcOutput(methodNsid, resBody)
      } catch (e: unknown) {
        if (e instanceof ValidationError) {
          throw new XRPCInvalidResponseError(methodNsid, e, resBody)
        }

        throw e
      }

      return new XRPCResponse(resBody, resHeaders)
    } catch (err) {
      throw XRPCError.from(err)
    }
  }
}
