import { resolveTxt } from 'node:dns/promises'
import { Client, buildAgent } from '@atproto/lex-client'
import { LexiconDocument, lexiconDocumentSchema } from '@atproto/lex-document'
import { AtUri, NSID } from '@atproto/syntax'
import {
  CreateDidResolverOptions,
  Did,
  DidResolver,
  ResolveDidOptions,
  assertDid,
  createDidResolver,
  extractPdsUrl,
} from '@atproto-labs/did-resolver'
import { LexResolverError } from './lex-resolver-error.js'

export type LexResolverOptions = CreateDidResolverOptions & {
  didAuthority?: Did
}

export { AtUri, NSID }
export type { LexiconDocument, ResolveDidOptions }

export class LexResolver {
  protected readonly didResolver: DidResolver<'plc' | 'web'>

  constructor(protected readonly options: LexResolverOptions) {
    this.didResolver = createDidResolver(options)
  }

  async get(
    nsidStr: NSID | string,
    options?: ResolveDidOptions,
  ): Promise<{
    uri: AtUri
    document: LexiconDocument
  }> {
    const uri = await this.resolve(nsidStr)
    const document = await this.fetch(uri, options)
    return { uri, document }
  }

  async resolve(nsidStr: NSID | string): Promise<AtUri> {
    const nsid = NSID.from(nsidStr)
    const did =
      this.options.didAuthority ??
      (await resolveLexiconDidAuthority(nsid).catch((cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to resolve DID authority for Lexicon`,
          { cause },
        )
      }))

    return AtUri.make(did, 'com.atproto.lexicon.schema', nsid.toString())
  }

  async fetch(
    uriStr: AtUri | string,
    options?: ResolveDidOptions,
  ): Promise<LexiconDocument> {
    const uri = typeof uriStr === 'string' ? new AtUri(uriStr) : uriStr
    const { did, nsid } = parseLexiconUri(uri)

    if (this.options.didAuthority && this.options.didAuthority !== did) {
      throw new LexResolverError(
        nsid,
        `DID authority mismatch: expected ${this.options.didAuthority}, got ${did}`,
      )
    }

    const didDocument = await this.didResolver
      .resolve(did, options)
      .catch((cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to resolve DID document for ${uri}`,
          { cause },
        )
      })

    let service: URL
    try {
      service = extractPdsUrl(didDocument)
    } catch (cause) {
      throw new LexResolverError(
        nsid,
        `No PDS service endpoint found in DID document for ${uri}`,
        { cause },
      )
    }

    const agent = buildAgent({
      service,
      fetch: this.options.fetch,
    })

    // TODO: use com.atproto.sync.getRecord and check signature using
    // DID document key
    const response = await new Client(agent)
      .getRecord('com.atproto.lexicon.schema', nsid.toString(), { repo: did })
      .catch((cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to fetch Lexicon document at ${uri}`,
          { cause },
        )
      })

    const result = lexiconDocumentSchema.validate(response.body.value)
    if (!result.success) {
      throw new LexResolverError(nsid, `Invalid Lexicon document at ${uri}`, {
        cause: result.error,
      })
    }

    const document = result.value

    if (document.id !== nsid.toString()) {
      throw new LexResolverError(
        nsid,
        `Invalid document id "${document.id}" for ${uri}`,
      )
    }

    return document
  }
}

function parseLexiconUri(uri: AtUri): {
  did: Did
  nsid: NSID
} {
  // Validate input URI
  const nsid = NSID.from(uri.rkey)
  const did = uri.host
  assertDid(did)

  return { did, nsid }
}

async function resolveLexiconDidAuthority(nsid: NSID): Promise<Did> {
  try {
    return await getDomainTxtDid(`_lexicon.${nsid.authority}`)
  } catch (cause) {
    throw new LexResolverError(
      nsid,
      `Failed to resolve lexicon DID authority`,
      { cause },
    )
  }
}

async function getDomainTxtDid(domain: string): Promise<Did> {
  return parseDnsResult(await resolveTxt(domain))
}

function parseDnsResult(chunkedResults: string[][]): Did {
  const didDefs = chunkedResults
    .map((chunks) => chunks.join(''))
    .filter((i) => i.startsWith('did='))

  if (didDefs.length === 1) {
    const did = didDefs[0].slice(4)
    assertDid(did)
    return did
  }

  throw didDefs.length > 1
    ? new Error('Multiple DIDs found in DNS TXT records')
    : new Error('No DID found in DNS TXT records')
}
