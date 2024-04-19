import { LexiconDoc, Lexicons, ValidationError } from '@atproto/lexicon'
import {
  CallOptions,
  QueryParams,
  ResponseType,
  XRPCError,
  XRPCInvalidResponseError,
  XRPCResponse,
} from './types'
import {
  constructMethodCallHeaders,
  constructMethodCallUrl,
  encodeMethodCallBody,
  getMethodSchemaHTTPMethod,
  httpResponseBodyParse,
  httpResponseCodeToEnum,
  isErrorResponseBody,
} from './util'
import { XrpcAgent, isXrpcAgent } from './xrpc-agent'
import { XrpcFetchAgent, XrpcFetchAgentOptions } from './xrpc-fetch-agent'

export class XrpcClient {
  readonly agent: XrpcAgent
  readonly lex: Lexicons

  protected headers = new Map<
    string,
    string | (() => string | PromiseLike<string>)
  >()

  constructor(
    agent: XrpcAgent | XrpcFetchAgentOptions,
    lex?: Lexicons | Iterable<LexiconDoc>,
  ) {
    this.agent = isXrpcAgent(agent) ? agent : new XrpcFetchAgent(agent)
    this.lex = lex instanceof Lexicons ? lex : new Lexicons(lex)
  }

  setHeader(
    key: string,
    value: string | (() => string | PromiseLike<string>),
  ): void {
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
      throw new Error(
        `Invalid lexicon: ${methodNsid}. Must be a query or procedure.`,
      )
    }

    const reqUrl = constructMethodCallUrl(methodNsid, def, params)
    const reqMethod = getMethodSchemaHTTPMethod(def)
    const reqHeaders = constructMethodCallHeaders(def, data, opts)
    const reqBody = encodeMethodCallBody(reqHeaders, data)

    for (const [key, value] of this.headers) {
      if (!Object.hasOwn(reqHeaders, key)) {
        reqHeaders[key] = typeof value === 'function' ? await value() : value
      }
    }

    // The duplex field is required for streaming bodies, but not yet reflected
    // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
    const init: RequestInit & { duplex: 'half' } = {
      method: reqMethod,
      headers: reqHeaders,
      body: reqBody,
      duplex: 'half',
      signal: opts?.signal,
    }

    const response = await this.agent.fetchHandler(reqUrl, init)

    const resStatus = response.status
    const resHeaders = Object.fromEntries(response.headers.entries())
    const resBody = httpResponseBodyParse(
      response.headers.get('content-type'),
      response.body ? await response.arrayBuffer() : undefined,
    )

    const resCode = httpResponseCodeToEnum(resStatus)
    if (resCode === ResponseType.Success) {
      try {
        this.lex.assertValidXrpcOutput(methodNsid, resBody)
      } catch (e: unknown) {
        if (e instanceof ValidationError) {
          throw new XRPCInvalidResponseError(methodNsid, e, resBody)
        } else {
          throw e
        }
      }
      return new XRPCResponse(resBody, resHeaders)
    } else {
      if (resBody && isErrorResponseBody(resBody)) {
        throw new XRPCError(resCode, resBody.error, resBody.message, resHeaders)
      } else {
        throw new XRPCError(resCode)
      }
    }
  }
}
