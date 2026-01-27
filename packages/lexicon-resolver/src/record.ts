import { CID } from 'multiformats/cid'
import { IdResolver, parseToAtprotoDocument } from '@atproto/identity'
import { RepoRecord } from '@atproto/lexicon'
import {
  Commit,
  MST,
  MemoryBlockstore,
  def as repoDef,
  readCarWithRoot,
  verifyCommitSig,
} from '@atproto/repo'
import { AtUri, ensureValidDid } from '@atproto/syntax'
import { BuildFetchHandlerOptions, FetchHandler } from '@atproto/xrpc'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import { AtpBaseClient as Client } from './client/index.js'
import { isValidDid } from './util.js'

/**
 * Resolve a record from the network.
 */
export type RecordResolver = (uri: AtUri | string) => Promise<RecordResolution>

/**
 * Resolve a record from the network, verifying its authenticity.
 */
export type AtprotoRecordResolver = (
  uri: AtUri | string,
  options?: ResolveRecordOptions,
) => Promise<RecordResolution>

export type BuildRecordResolverOptions = {
  idResolver?: IdResolver
  rpc?: Partial<BuildFetchHandlerOptions> | FetchHandler
}

export type ResolveRecordOptions = {
  forceRefresh?: boolean
}

export type RecordResolution = {
  commit: Commit
  uri: AtUri
  cid: CID
  record: RepoRecord
}

export { AtUri, CID, type Commit, IdResolver, type RepoRecord }

/**
 * Build a record resolver function.
 */
export function buildRecordResolver(
  options: BuildRecordResolverOptions = {},
): AtprotoRecordResolver {
  const { idResolver = new IdResolver(), rpc } = options
  return async function resolveRecord(
    uriStr: AtUri | string,
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
        ? rpc
        : {
            ...rpc,
            service: rpc?.service ?? pds,
            fetch: rpc?.fetch ?? safeFetch,
          },
    )
    const { data: proofBytes } = await client.com.atproto.sync
      .getRecord({
        did,
        collection: uri.collection,
        rkey: uri.rkey,
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
) {
  if (uri.host.startsWith('did:')) {
    ensureValidDid(uri.host)
    return uri.host
  }
  const resolved = await idResolver.handle.resolve(uri.host)
  if (!resolved || !isValidDid(resolved)) {
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
