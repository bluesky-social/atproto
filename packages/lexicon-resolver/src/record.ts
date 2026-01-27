import { IdResolver, parseToAtprotoDocument } from '@atproto/identity'
import {
  AgentConfig,
  Cid,
  Client,
  DidString,
  FetchHandler,
  LexMap,
  l,
} from '@atproto/lex'
import {
  Commit,
  MST,
  MemoryBlockstore,
  def as repoDef,
  readCarWithRoot,
  verifyCommitSig,
} from '@atproto/repo'
import { AtUri, AtUriString } from '@atproto/syntax'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import { com } from './lexicons.js'

export {
  type AgentConfig,
  type AtUriString,
  type Cid,
  type DidString,
  type FetchHandler,
  type LexMap,
} from '@atproto/lex'
export { AtUri } from '@atproto/syntax'
export { type Commit } from '@atproto/repo'
export { IdResolver } from '@atproto/identity'

/**
 * Resolve a record from the network.
 */
export type RecordResolver = (
  uri: AtUri | AtUriString,
) => Promise<RecordResolution>

/**
 * Resolve a record from the network, verifying its authenticity.
 */
export type AtprotoRecordResolver = (
  uri: AtUri | AtUriString,
  options?: ResolveRecordOptions,
) => Promise<RecordResolution>

export type BuildRecordResolverOptions = {
  idResolver?: IdResolver
  rpc?: Partial<AgentConfig> | FetchHandler
}

export type ResolveRecordOptions = {
  forceRefresh?: boolean
}

export type RecordResolution = {
  commit: Commit
  uri: AtUri
  cid: Cid
  record: LexMap
}

/**
 * Build a record resolver function.
 */
export function buildRecordResolver(
  options: BuildRecordResolverOptions = {},
): AtprotoRecordResolver {
  const { idResolver = new IdResolver(), rpc } = options
  return async function resolveRecord(
    uriStr: AtUri | AtUriString,
    opts: ResolveRecordOptions = {},
  ): Promise<RecordResolution> {
    const uri = typeof uriStr === 'string' ? new AtUri(uriStr) : uriStr
    const did = await getDidFromUri(uri, { idResolver })
    const identityDoc = await idResolver.did
      .ensureResolve(did, opts.forceRefresh)
      .catch((err) => {
        throw new RecordResolutionError('Could not resolve DID identity data', {
          cause: err,
        })
      })
    const { pds, signingKey } = parseToAtprotoDocument(identityDoc)
    if (!pds) {
      throw new RecordResolutionError(
        'Incomplete DID identity data: missing pds',
      )
    }
    if (!signingKey) {
      throw new RecordResolutionError(
        'Incomplete DID identity data: missing signing key',
      )
    }
    const client = new Client(
      typeof rpc === 'function'
        ? { fetchHandler: rpc }
        : {
            ...rpc,
            service: rpc?.service ?? pds,
            fetch: rpc?.fetch ?? safeFetch,
          },
    )
    const proofBytes = await client
      .call(com.atproto.sync.getRecord, {
        did,
        collection: uri.collection as l.NsidString,
        rkey: uri.rkey as l.RecordKeyString,
      })
      .catch((err) => {
        throw new RecordResolutionError('Could not fetch record proof', {
          cause: err,
        })
      })
    const verified = await verifyRecordProof(proofBytes, {
      uri: AtUri.make(did, uri.collection, uri.rkey),
      signingKey,
    })
    return verified
  }
}

export const resolveRecord = buildRecordResolver()

export const safeFetch = safeFetchWrap({
  allowIpHost: false,
  allowImplicitRedirect: true,
  responseMaxSize: (1024 + 10) * 1024, // 1MB + 10kB, just a bit larger than max record size
})

export class RecordResolutionError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RecordResolutionError'
  }
}

async function getDidFromUri(
  uri: AtUri,
  { idResolver }: { idResolver: IdResolver },
): Promise<DidString> {
  if (l.isDidString(uri.host)) {
    return uri.host
  }

  const resolved = await idResolver.handle.resolve(uri.host)
  if (!resolved || !l.isDidString(resolved)) {
    throw new RecordResolutionError('Could not resolve handle found in AT-URI')
  }

  return resolved
}

async function verifyRecordProof(
  proofBytes: Uint8Array,
  { uri, signingKey }: { uri: AtUri; signingKey: string },
) {
  const { root, blocks } = await readCarWithRoot(proofBytes).catch((err) => {
    throw new RecordResolutionError('Malformed record proof', { cause: err })
  })
  const blockstore = new MemoryBlockstore(blocks)
  const commit = await blockstore.readObj(root, repoDef.commit).catch((err) => {
    throw new RecordResolutionError('Invalid commit in record proof', {
      cause: err,
    })
  })
  if (commit.did !== uri.host) {
    throw new RecordResolutionError(`Invalid repo did: ${commit.did}`)
  }
  const validSig = await verifyCommitSig(commit, signingKey)
  if (!validSig) {
    throw new RecordResolutionError(
      `Invalid signature on commit: ${root.toString()}`,
    )
  }
  const mst = MST.load(blockstore, commit.data)
  const cid = await mst.get(`${uri.collection}/${uri.rkey}`)
  if (!cid) {
    throw new RecordResolutionError('Record not found in proof')
  }
  const record = await blockstore.readRecord(cid)
  return { commit, uri, cid, record }
}
