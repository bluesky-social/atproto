import { resolveTxt } from 'node:dns/promises'
import * as crypto from '@atproto/crypto'
import { buildAgent, xrpc } from '@atproto/lex-client'
import { Cid } from '@atproto/lex-data'
import { LexiconDocument, lexiconDocumentSchema } from '@atproto/lex-document'
import {
  MST,
  MemoryBlockstore,
  def as repoDef,
  readCarWithRoot,
  verifyCommitSig,
} from '@atproto/repo'
import { AtUri, NSID, NsidString } from '@atproto/syntax'
import {
  AtprotoVerificationMethod,
  CreateDidResolverOptions,
  Did,
  DidResolver,
  ResolveDidOptions,
  assertDid,
  createDidResolver,
  extractAtprotoData,
} from '@atproto-labs/did-resolver'
import { LexResolverError } from './lex-resolver-error.js'
import { com } from './lexicons/index.js'

export type LexResolverResult = {
  uri: AtUri
  cid: Cid
  lexicon: LexiconDocument
}

export type LexResolverFetchResult = {
  cid: Cid
  lexicon: LexiconDocument
}

type Awaitable<T> = T | Promise<T>

export type LexResolverHooks = {
  /**
   * Hook called before resolving a lexicon authority DID. If a DID is returned,
   * it will be used instead of performing the default resolution. In that case,
   * the `onResolveAuthorityResult` and `onResolveAuthorityError` hooks will
   * not be called.
   */
  onResolveAuthority?(data: { nsid: NSID }): Awaitable<void | Did>
  onResolveAuthorityResult?(data: { nsid: NSID; did: Did }): Awaitable<void>
  onResolveAuthorityError?(data: { nsid: NSID; err: unknown }): Awaitable<void>

  /**
   * Hook called before fetching a lexicon URI. If a result is returned, it will
   * be used instead of performing the default fetch. In that case, the
   * `onFetchResult` and `onFetchError` hooks will not be called.
   */
  onFetch?(data: { uri: AtUri }): Awaitable<void | LexResolverFetchResult>
  onFetchResult?(data: {
    uri: AtUri
    cid: Cid
    lexicon: LexiconDocument
  }): Awaitable<void>
  onFetchError?(data: { uri: AtUri; err: unknown }): Awaitable<void>
}

export type LexResolverOptions = CreateDidResolverOptions & {
  hooks?: LexResolverHooks
}

export { AtUri, type Cid, NSID }
export type { LexiconDocument, ResolveDidOptions }

export class LexResolver {
  protected readonly didResolver: DidResolver<'plc' | 'web'>

  constructor(protected readonly options: LexResolverOptions) {
    this.didResolver = createDidResolver(options)
  }

  async get(
    nsidStr: NSID | string,
    options?: ResolveDidOptions,
  ): Promise<LexResolverResult> {
    const uri = await this.resolve(nsidStr)
    return this.fetch(uri, options)
  }

  async resolve(nsidStr: NSID | string): Promise<AtUri> {
    const nsid = NSID.from(nsidStr)

    const did =
      (await this.options.hooks?.onResolveAuthority?.({ nsid })) ??
      (await this.resolveLexiconAuthority(nsid).then(
        async (did) => {
          await this.options.hooks?.onResolveAuthorityResult?.({ nsid, did })
          return did
        },
        async (err) => {
          await this.options.hooks?.onResolveAuthorityError?.({ nsid, err })
          throw err
        },
      ))

    return AtUri.make(did, 'com.atproto.lexicon.schema', nsid.toString())
  }

  // @TODO This class could be made compatible with browsers by making the
  // following method abstract and/or by allowing the caller to inject a DNS
  // resolver implementation (based on DNS-over-HTTPS or similar), instead of
  // using the Node.js built-in resolver.
  protected async resolveLexiconAuthority(nsid: NSID): Promise<Did> {
    try {
      return await getDomainTxtDid(`_lexicon.${nsid.authority}`)
    } catch (cause) {
      throw new LexResolverError(
        nsid,
        `Failed to resolve lexicon DID authority for ${nsid}`,
        { cause },
      )
    }
  }

  async fetch(
    uriStr: AtUri | string,
    options?: ResolveDidOptions,
  ): Promise<LexResolverResult> {
    const uri = typeof uriStr === 'string' ? new AtUri(uriStr) : uriStr

    const { lexicon, cid } =
      (await this.options.hooks?.onFetch?.({ uri })) ??
      (await this.fetchLexiconUri(uri, options).then(
        async (res) => {
          await this.options.hooks?.onFetchResult?.({ uri, ...res })
          return res
        },
        async (err) => {
          await this.options.hooks?.onFetchError?.({ uri, err })
          throw err
        },
      ))

    return { uri, cid, lexicon }
  }

  protected async fetchLexiconUri(
    uri: AtUri,
    options?: ResolveDidOptions,
  ): Promise<LexResolverFetchResult> {
    const { did, nsid } = parseLexiconUri(uri)

    const { pds, key } = await this.didResolver
      .resolve(did, options)
      .then(extractAtprotoData)
      .catch((cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to resolve DID document for ${did}`,
          { cause },
        )
      })

    if (!key || !pds || !URL.canParse(pds.serviceEndpoint)) {
      throw new LexResolverError(
        nsid,
        `No atproto PDS service endpoint or signing key found in ${did} DID document`,
      )
    }

    const agent = buildAgent({
      service: pds.serviceEndpoint,
      fetch: this.options.fetch,
    })

    const collection = 'com.atproto.lexicon.schema'
    const rkey = nsid.toString()

    const { cid, record } = await xrpc(agent, com.atproto.sync.getRecord, {
      signal: options?.signal,
      headers: options?.noCache ? { 'Cache-Control': 'no-cache' } : undefined,
      params: { did, collection, rkey },
    }).then(
      ({ body }) => {
        return verifyRecordProof(body, did, key, collection, rkey).catch(
          (cause) => {
            throw new LexResolverError(
              nsid,
              `Failed to verify Lexicon record proof at ${uri}`,
              { cause },
            )
          },
        )
      },
      (cause) => {
        throw new LexResolverError(nsid, `Failed to fetch Record ${uri}`, {
          cause,
        })
      },
    )

    const validationResult = lexiconDocumentSchema.safeParse(record)
    if (!validationResult.success) {
      throw new LexResolverError(nsid, `Invalid Lexicon document at ${uri}`, {
        cause: validationResult.reason,
      })
    }

    const lexicon = validationResult.value
    if (lexicon.id !== uri.rkey) {
      throw new LexResolverError(
        nsid,
        `Invalid document id "${lexicon.id}" at ${uri}`,
      )
    }

    return { lexicon, cid }
  }
}

function parseLexiconUri(uri: AtUri): {
  did: Did
  nsid: NSID
} {
  // Validate input URI
  const nsid = NSID.from(uri.rkey)
  try {
    const did = uri.host
    assertDid(did)
    return { did, nsid }
  } catch (cause) {
    throw new LexResolverError(nsid, `URI host is not a DID ${uri}`, { cause })
  }
}

async function getDomainTxtDid(domain: string): Promise<Did> {
  const didLines = (await resolveTxt(domain))
    .map((chunks) => chunks.join(''))
    .filter((i) => i.startsWith('did='))

  if (didLines.length === 1) {
    const did = didLines[0].slice(4)
    assertDid(did)
    return did
  }

  throw didLines.length > 1
    ? new Error('Multiple DIDs found in DNS TXT records')
    : new Error('No DID found in DNS TXT records')
}

async function verifyRecordProof(
  car: Uint8Array,
  did: Did,
  key: AtprotoVerificationMethod,
  collection: NsidString,
  rkey: string,
) {
  const { root, blocks } = await readCarWithRoot(car)
  const blockstore = new MemoryBlockstore(blocks)

  const commit = await blockstore.readObj(root, repoDef.commit)
  if (commit.did !== did) {
    throw new Error(`Invalid repo did: ${commit.did}`)
  }

  const signingKey = getDidKeyFromMultibase(key)
  const validSig = await verifyCommitSig(commit, signingKey)
  if (!validSig) {
    throw new Error(`Invalid signature on commit: ${root.toString()}`)
  }

  const mst = MST.load(blockstore, commit.data)

  const cid = await mst.get(`${collection}/${rkey}`)
  if (!cid) throw new Error('Record not found in proof')

  const record = await blockstore.readRecord(cid)
  if (record?.$type !== collection) {
    throw new Error(
      `Invalid record type: expected ${collection}, got ${record?.$type}`,
    )
  }

  return { cid, record }
}

function getDidKeyFromMultibase(key: AtprotoVerificationMethod) {
  switch (key.type) {
    case 'EcdsaSecp256r1VerificationKey2019': {
      const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
      return crypto.formatDidKey(crypto.P256_JWT_ALG, keyBytes)
    }
    case 'EcdsaSecp256k1VerificationKey2019': {
      const keyBytes = crypto.multibaseToBytes(key.publicKeyMultibase)
      return crypto.formatDidKey(crypto.SECP256K1_JWT_ALG, keyBytes)
    }
    case 'Multikey': {
      const { jwtAlg, keyBytes } = crypto.parseMultikey(key.publicKeyMultibase)
      return crypto.formatDidKey(jwtAlg, keyBytes)
    }
    default: {
      // Should never happen
      throw new Error(`Unsupported verification method type: ${key.type}`)
    }
  }
}
