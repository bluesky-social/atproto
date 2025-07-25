import { CID } from 'multiformats/cid'
import { IdResolver } from '@atproto/identity'
import { RepoRecord } from '@atproto/lexicon'
import {
  Commit,
  MST,
  MemoryBlockstore,
  RepoVerificationError,
  def as repoDef,
  readCarWithRoot,
  verifyCommitSig,
} from '@atproto/repo'
import { AtUri, ensureValidDid } from '@atproto/syntax'
import { BuildFetchHandlerOptions, FetchHandler } from '@atproto/xrpc'
import { safeFetchWrap } from '@atproto-labs/fetch-node'
import { AtpBaseClient as Client } from './client/index.js'

export type ResolveRecordOptions = {
  idResolver?: IdResolver
  forceRefresh?: boolean
  rpc?: Partial<BuildFetchHandlerOptions> | FetchHandler
}

export type RecordResolution = {
  commit: Commit
  uri: AtUri
  cid: CID
  record: RepoRecord
}

/**
 * Resolve a record from the network, verifying its authenticity.
 * @param uriStr AtUri or string representing one for the record that will be resolved.
 * @param options
 * @returns
 */
export async function resolveRecord(
  uriStr: AtUri | string,
  options: ResolveRecordOptions = {},
): Promise<RecordResolution> {
  const { idResolver = new IdResolver(), forceRefresh, rpc } = options
  const uri = typeof uriStr === 'string' ? new AtUri(uriStr) : uriStr
  const did = await getDidFromUri(uri, { idResolver })
  const identity = await idResolver.did.resolveAtprotoData(did, forceRefresh)
  const client = new Client(
    typeof rpc === 'function'
      ? rpc
      : { service: identity.pds, fetch: safeFetch, ...rpc },
  )
  const { data: proofBytes } = await client.com.atproto.sync.getRecord({
    did,
    collection: uri.collection,
    rkey: uri.rkey,
  })
  const verified = await verifyRecordProof(proofBytes, {
    uri: AtUri.make(did, uri.collection, uri.rkey),
    signingKey: identity.signingKey,
  })
  return verified
}

export const safeFetch = safeFetchWrap({
  allowIpHost: false,
  allowImplicitRedirect: true,
  responseMaxSize: (1024 + 10) * 1024, // 1MB + 10kB, just a bit larger than max record size
})

async function getDidFromUri(
  uri: AtUri,
  { idResolver }: { idResolver: IdResolver },
) {
  let did: string
  if (uri.host.startsWith('did:')) {
    did = uri.host
  } else {
    const resolved = await idResolver.handle.resolve(uri.host)
    if (!resolved) {
      throw new Error('Could not resolve handle found in AT-URI.')
    }
    did = resolved
  }
  ensureValidDid(did)
  return did
}

async function verifyRecordProof(
  proofBytes: Uint8Array,
  { uri, signingKey }: { uri: AtUri; signingKey: string },
) {
  const { root, blocks } = await readCarWithRoot(proofBytes, {
    verifyCids: true,
  })
  const blockstore = new MemoryBlockstore(blocks)
  const commit = await blockstore.readObj(root, repoDef.commit)
  if (commit.did !== uri.host) {
    throw new RepoVerificationError(`Invalid repo did: ${commit.did}`)
  }
  const validSig = await verifyCommitSig(commit, signingKey)
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${root.toString()}`,
    )
  }
  const mst = MST.load(blockstore, commit.data)
  const cid = await mst.get(`${uri.collection}/${uri.rkey}`)
  if (!cid) {
    throw new RepoVerificationError('Record not found')
  }
  const record = await blockstore.readRecord(cid)
  return { commit, uri, cid, record }
}
