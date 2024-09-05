import { CID } from 'multiformats/cid'
import { MemoryBlockstore, ReadableBlockstore, SyncStorage } from '../storage'
import DataDiff from '../data-diff'
import ReadableRepo from '../readable-repo'
import * as util from '../util'
import {
  RecordClaim,
  RecordCidClaim,
  VerifiedDiff,
  VerifiedRepo,
} from '../types'
import { def } from '../types'
import { MST } from '../mst'
import BlockMap from '../block-map'

export const verifyRepoCar = async (
  carBytes: Uint8Array,
  did?: string,
  signingKey?: string,
): Promise<VerifiedRepo> => {
  const car = await util.readCarWithRoot(carBytes)
  return verifyRepo(car.blocks, car.root, did, signingKey)
}

export const verifyRepo = async (
  blocks: BlockMap,
  head: CID,
  did?: string,
  signingKey?: string,
  opts?: { ensureLeaves?: boolean },
): Promise<VerifiedRepo> => {
  const diff = await verifyDiff(null, blocks, head, did, signingKey, opts)
  const creates = util.ensureCreates(diff.writes)
  return {
    creates,
    commit: diff.commit,
  }
}

export const verifyDiffCar = async (
  repo: ReadableRepo | null,
  carBytes: Uint8Array,
  did?: string,
  signingKey?: string,
  opts?: { ensureLeaves?: boolean },
): Promise<VerifiedDiff> => {
  const car = await util.readCarWithRoot(carBytes)
  return verifyDiff(repo, car.blocks, car.root, did, signingKey, opts)
}

export const verifyDiff = async (
  repo: ReadableRepo | null,
  updateBlocks: BlockMap,
  updateRoot: CID,
  did?: string,
  signingKey?: string,
  opts?: { ensureLeaves?: boolean },
): Promise<VerifiedDiff> => {
  const { ensureLeaves = true } = opts ?? {}
  const stagedStorage = new MemoryBlockstore(updateBlocks)
  const updateStorage = repo
    ? new SyncStorage(stagedStorage, repo.storage)
    : stagedStorage
  const updated = await verifyRepoRoot(
    updateStorage,
    updateRoot,
    did,
    signingKey,
  )
  const diff = await DataDiff.of(updated.data, repo?.data ?? null)
  const writes = await util.diffToWriteDescripts(diff)
  const newBlocks = diff.newMstBlocks
  const leaves = updateBlocks.getMany(diff.newLeafCids.toList())
  if (leaves.missing.length > 0 && ensureLeaves) {
    throw new Error(`missing leaf blocks: ${leaves.missing}`)
  }
  newBlocks.addMap(leaves.blocks)
  const removedCids = diff.removedCids
  const commitCid = await newBlocks.add(updated.commit)
  // ensure the commit cid actually changed
  if (repo) {
    if (commitCid.equals(repo.cid)) {
      newBlocks.delete(commitCid)
    } else {
      removedCids.add(repo.cid)
    }
  }
  return {
    writes,
    commit: {
      cid: updated.cid,
      rev: updated.commit.rev,
      prev: repo?.cid ?? null,
      since: repo?.commit.rev ?? null,
      newBlocks,
      removedCids,
    },
  }
}

// @NOTE only verifies the root, not the repo contents
const verifyRepoRoot = async (
  storage: ReadableBlockstore,
  head: CID,
  did?: string,
  signingKey?: string,
): Promise<ReadableRepo> => {
  const repo = await ReadableRepo.load(storage, head)
  if (did !== undefined && repo.did !== did) {
    throw new RepoVerificationError(`Invalid repo did: ${repo.did}`)
  }
  if (signingKey !== undefined) {
    const validSig = await util.verifyCommitSig(repo.commit, signingKey)
    if (!validSig) {
      throw new RepoVerificationError(
        `Invalid signature on commit: ${repo.cid.toString()}`,
      )
    }
  }
  return repo
}

export const verifyProofs = async (
  proofs: Uint8Array,
  claims: RecordCidClaim[],
  did: string,
  didKey: string,
): Promise<{ verified: RecordCidClaim[]; unverified: RecordCidClaim[] }> => {
  const car = await util.readCarWithRoot(proofs)
  const blockstore = new MemoryBlockstore(car.blocks)
  const commit = await blockstore.readObj(car.root, def.commit)
  if (commit.did !== did) {
    throw new RepoVerificationError(`Invalid repo did: ${commit.did}`)
  }
  const validSig = await util.verifyCommitSig(commit, didKey)
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${car.root.toString()}`,
    )
  }
  const mst = MST.load(blockstore, commit.data)
  const verified: RecordCidClaim[] = []
  const unverified: RecordCidClaim[] = []
  for (const claim of claims) {
    const found = await mst.get(
      util.formatDataKey(claim.collection, claim.rkey),
    )
    const record = found ? await blockstore.readObj(found, def.map) : null
    if (claim.cid === null) {
      if (record === null) {
        verified.push(claim)
      } else {
        unverified.push(claim)
      }
    } else {
      if (claim.cid.equals(found)) {
        verified.push(claim)
      } else {
        unverified.push(claim)
      }
    }
  }
  return { verified, unverified }
}

export const verifyRecords = async (
  proofs: Uint8Array,
  did: string,
  signingKey: string,
): Promise<RecordClaim[]> => {
  const car = await util.readCarWithRoot(proofs)
  const blockstore = new MemoryBlockstore(car.blocks)
  const commit = await blockstore.readObj(car.root, def.commit)
  if (commit.did !== did) {
    throw new RepoVerificationError(`Invalid repo did: ${commit.did}`)
  }
  const validSig = await util.verifyCommitSig(commit, signingKey)
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${car.root.toString()}`,
    )
  }
  const mst = MST.load(blockstore, commit.data)

  const records: RecordClaim[] = []
  const leaves = await mst.reachableLeaves()
  for (const leaf of leaves) {
    const { collection, rkey } = util.parseDataKey(leaf.key)
    const record = await blockstore.attemptReadRecord(leaf.value)
    if (record) {
      records.push({
        collection,
        rkey,
        record,
      })
    }
  }
  return records
}

export class RepoVerificationError extends Error {}
