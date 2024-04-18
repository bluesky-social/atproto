import { LexiconDoc, Lexicons } from '@atproto/lexicon'
import {
  CallOptions,
  FetchAgent,
  FetchHandler,
  FetchHandlerResponse,
  Headers,
  QueryParams,
  ResponseType,
  XRPCError,
} from './types'
import { encodeMethodCallBody, httpResponseBodyParse } from './util'
import { XrpcClient } from './xrpc-client'

/** @deprecated Use {@link XrpcClient} instead */
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

/** @deprecated Use {@link XrpcClient} instead */
export class ServiceClient extends XrpcClient {
  uri: URL

  constructor(
    public baseClient: Client,
    serviceUri: string | URL,
  ) {
    super(
      <FetchAgent>{
        fetch: (
          httpUrl: string,
          httpMethod: string,
          httpHeaders: Headers,
          httpReqBody: unknown,
        ): Promise<FetchHandlerResponse> => {
          const uri = new URL(httpUrl, this.uri).toString()
          return this.baseClient.fetch(
            uri,
            httpMethod,
            httpHeaders,
            httpReqBody,
          )
        },
      },
      baseClient.lex,
    )
    this.uri = typeof serviceUri === 'string' ? new URL(serviceUri) : serviceUri
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
    const reqInit: RequestInit & { duplex: string } = {
      method: httpMethod,
      headers: httpHeaders,
      body: encodeMethodCallBody(httpHeaders, httpReqBody),
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
