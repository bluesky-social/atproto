import { resolveTxt } from 'node:dns/promises'
import * as crypto from '@atproto/crypto'
import { buildAgent, xrpc } from '@atproto/lex-client'
import { Cid, asCid } from '@atproto/lex-data'
import { LexiconDocument, lexiconDocumentSchema } from '@atproto/lex-document'
import {
  MST,
  MemoryBlockstore,
  def as repoDef,
  readCarWithRoot,
  verifyCommitSig,
} from '@atproto/repo'
import { AtUri, NSID } from '@atproto/syntax'
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
import * as com from './lexicons/com.js'

export type LexResolverOptions = CreateDidResolverOptions & {
  didAuthority?: Did
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
  ): Promise<{
    uri: AtUri
    cid: Cid
    lexicon: LexiconDocument
  }> {
    const uri = await this.resolve(nsidStr)
    return this.fetch(uri, options)
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
  ): Promise<{
    uri: AtUri
    cid: Cid
    lexicon: LexiconDocument
  }> {
    const uri = typeof uriStr === 'string' ? new AtUri(uriStr) : uriStr
    const { nsid, did } = parseLexiconUri(uri)

    const { pds, key } = await this.didResolver
      .resolve(did, options)
      .then(extractAtprotoData)
      .catch((cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to resolve DID document for ${uri}`,
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

    const response = await xrpc(agent, com.atproto.sync.getRecord, {
      signal: options?.signal,
      headers: options?.noCache ? { 'Cache-Control': 'no-cache' } : undefined,
      params: {
        did,
        collection: 'com.atproto.lexicon.schema',
        rkey: nsid.toString(),
      },
    }).catch((cause) => {
      throw new LexResolverError(
        nsid,
        `Failed to fetch Lexicon document at ${uri}`,
        { cause },
      )
    })

    const verified = await verifyRecordProof(response.body, uri, key).catch(
      (cause) => {
        throw new LexResolverError(
          nsid,
          `Failed to verify Lexicon record proof at ${uri}`,
          { cause },
        )
      },
    )

    const result = lexiconDocumentSchema.validate(verified.record)
    if (!result.success) {
      throw new LexResolverError(nsid, `Invalid Lexicon document at ${uri}`, {
        cause: result.error,
      })
    }

    const lexicon = result.value
    if (lexicon.id !== nsid.toString()) {
      throw new LexResolverError(
        nsid,
        `Invalid document id "${lexicon.id}" for ${uri}`,
      )
    }

    const cid = asCid(verified.cid)
    if (!cid) {
      throw new LexResolverError(
        nsid,
        `Invalid CID "${verified.cid.toString()}" for ${uri}`,
      )
    }

    return { lexicon, uri, cid }
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
  uri: AtUri,
  key: AtprotoVerificationMethod,
) {
  const signingKey = getDidKeyFromMultibase(key)
  const { root, blocks } = await readCarWithRoot(car)
  const blockstore = new MemoryBlockstore(blocks)
  const commit = await blockstore.readObj(root, repoDef.commit)
  if (commit.did !== uri.host) {
    throw new Error(`Invalid repo did: ${commit.did}`)
  }
  const validSig = await verifyCommitSig(commit, signingKey)
  if (!validSig) {
    throw new Error(`Invalid signature on commit: ${root.toString()}`)
  }
  const mst = MST.load(blockstore, commit.data)
  const cid = await mst.get(`${uri.collection}/${uri.rkey}`)
  if (!cid) {
    throw new Error('Record not found in proof')
  }
  const record = await blockstore.readRecord(cid)
  return { commit, uri, cid, record }
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
