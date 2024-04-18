import { LexiconDoc, Lexicons, ValidationError } from '@atproto/lexicon'
import {
  CallOptions,
  FetchAgent,
  QueryParams,
  ResponseType,
  XRPCError,
  XRPCInvalidResponseError,
  XRPCResponse,
} from './types'
import {
  constructMethodCallHeaders,
  constructMethodCallUrl,
  getMethodSchemaHTTPMethod,
  httpResponseCodeToEnum,
  isErrorResponseBody,
} from './util'
import { XrpcAgent } from './xrpc-agent'

export class XrpcClient {
  readonly lex: Lexicons
  readonly agent: FetchAgent

  headers: Record<string, string> = {}

  constructor(
    agent: FetchAgent | URL | string,
    lex?: Lexicons | Iterable<LexiconDoc>,
  ) {
    this.lex = lex instanceof Lexicons ? lex : new Lexicons(lex)
    this.agent =
      typeof agent === 'string' || agent instanceof URL
        ? XrpcAgent.forOrigin(agent)
        : agent
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
  ): Promise<XRPCResponse> {
    const def = this.lex.getDefOrThrow(methodNsid)
    if (!def || (def.type !== 'query' && def.type !== 'procedure')) {
      throw new Error(
        `Invalid lexicon: ${methodNsid}. Must be a query or procedure.`,
      )
    }

    const httpMethod = getMethodSchemaHTTPMethod(def)
    const httpUrl = constructMethodCallUrl(methodNsid, def, params)
    const httpHeaders = constructMethodCallHeaders(def, data, {
      headers: {
        ...this.headers,
        ...opts?.headers,
      },
      encoding: opts?.encoding,
    })

    const res = await this.agent.fetch(httpUrl, httpMethod, httpHeaders, data)

    const resCode = httpResponseCodeToEnum(res.status)
    if (resCode === ResponseType.Success) {
      try {
        this.lex.assertValidXrpcOutput(methodNsid, res.body)
      } catch (e: unknown) {
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
