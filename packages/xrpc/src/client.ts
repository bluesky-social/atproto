import { LexiconDoc, Lexicons } from '@atproto/lexicon'
import { CallOptions, QueryParams } from './types'
import { XrpcClient } from './xrpc-client'
import { combineHeaders } from './util'

/** @deprecated Use {@link XrpcClient} instead */
export class Client {
  /** @deprecated */
  get fetch(): never {
    throw new Error(
      'Client.fetch is no longer supported. Use an XrpcClient instead.',
    )
  }

  /** @deprecated */
  set fetch(_: never) {
    throw new Error(
      'Client.fetch is no longer supported. Use an XrpcClient instead.',
    )
  }

  lex = new Lexicons()

  // method calls
  //

  async call(
    serviceUri: string | URL,
    methodNsid: string,
    params?: QueryParams,
    data?: BodyInit | null,
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
    super(async (input, init) => {
      const headers = combineHeaders(init.headers, Object.entries(this.headers))
      return fetch(new URL(input, this.uri), { ...init, headers })
    }, baseClient.lex)
    this.uri = typeof serviceUri === 'string' ? new URL(serviceUri) : serviceUri
  }
}
