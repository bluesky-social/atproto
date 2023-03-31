import { CID } from 'multiformats/cid'
import { MemoryBlockstore, ReadableBlockstore, RepoStorage } from './storage'
import DataDiff from './data-diff'
import SyncStorage from './storage/sync-storage'
import ReadableRepo from './readable-repo'
import Repo from './repo'
import CidSet from './cid-set'
import * as util from './util'
import { RecordClaim, RepoContents, RepoContentsWithCids } from './types'
import { def } from './types'
import { MST } from './mst'
import { cidForCbor } from '@atproto/common'

export type VerifiedCheckout = {
  contents: RepoContents
  newCids: CidSet
}

export type VerifiedCheckoutWithCids = {
  commit: CID
  contents: RepoContentsWithCids
}

export const verifyCheckout = async (
  storage: ReadableBlockstore,
  head: CID,
  did: string,
  signingKey: string,
): Promise<VerifiedCheckout> => {
  const repo = await verifyRepoRoot(storage, head, did, signingKey)
  const diff = await DataDiff.of(repo.data, null)
  const newCids = new CidSet([repo.cid]).addSet(diff.newCids)

  const contents: RepoContents = {}
  for (const add of diff.addList()) {
    const { collection, rkey } = util.parseDataKey(add.key)
    if (!contents[collection]) {
      contents[collection] = {}
    }
    const record = await storage.readRecord(add.cid)
    contents[collection][rkey] = record
  }

  return {
    contents,
    newCids,
  }
}

export const verifyCheckoutWithCids = async (
  storage: ReadableBlockstore,
  head: CID,
  did: string,
  signingKey: string,
): Promise<VerifiedCheckoutWithCids> => {
  const repo = await verifyRepoRoot(storage, head, did, signingKey)
  const diff = await DataDiff.of(repo.data, null)

  const contents: RepoContentsWithCids = {}
  for (const add of diff.addList()) {
    const { collection, rkey } = util.parseDataKey(add.key)
    contents[collection] ??= {}
    contents[collection][rkey] = {
      cid: add.cid,
      value: await storage.readRecord(add.cid),
    }
  }

  return {
    commit: repo.cid,
    contents,
  }
}

// @NOTE only verifies the root, not the repo contents
const verifyRepoRoot = async (
  storage: ReadableBlockstore,
  head: CID,
  did: string,
  signingKey: string,
): Promise<ReadableRepo> => {
  const repo = await ReadableRepo.load(storage, head)
  if (repo.did !== did) {
    throw new RepoVerificationError(`Invalid repo did: ${repo.did}`)
  }
  const validSig = await util.verifyCommitSig(repo.commit, signingKey)
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${repo.cid.toString()}`,
    )
  }
  return repo
}

export type VerifiedUpdate = {
  commit: CID
  prev: CID | null
  diff: DataDiff
  newCids: CidSet
}

export const verifyFullHistory = async (
  storage: RepoStorage,
  head: CID,
  did: string,
  signingKey: string,
): Promise<VerifiedUpdate[]> => {
  const commitPath = await storage.getCommitPath(head, null)
  if (commitPath === null) {
    throw new RepoVerificationError('Could not find shared history')
  } else if (commitPath.length < 1) {
    throw new RepoVerificationError('Expected at least one commit')
  }
  const baseRepo = await Repo.load(storage, commitPath[0])
  const baseDiff = await DataDiff.of(baseRepo.data, null)
  const baseRepoCids = new CidSet([baseRepo.cid]).addSet(baseDiff.newCids)
  const init: VerifiedUpdate = {
    commit: baseRepo.cid,
    prev: null,
    diff: baseDiff,
    newCids: baseRepoCids,
  }
  const updates = await verifyCommitPath(
    baseRepo,
    storage,
    commitPath.slice(1),
    did,
    signingKey,
  )
  return [init, ...updates]
}

export const verifyUpdates = async (
  repo: ReadableRepo,
  updateStorage: RepoStorage,
  updateRoot: CID,
  did: string,
  signingKey: string,
): Promise<VerifiedUpdate[]> => {
  const commitPath = await updateStorage.getCommitPath(updateRoot, repo.cid)
  if (commitPath === null) {
    throw new RepoVerificationError('Could not find shared history')
  }
  const syncStorage = new SyncStorage(updateStorage, repo.storage)
  return verifyCommitPath(repo, syncStorage, commitPath, did, signingKey)
}

export const verifyCommitPath = async (
  baseRepo: ReadableRepo,
  storage: ReadableBlockstore,
  commitPath: CID[],
  did: string,
  signingKey: string,
): Promise<VerifiedUpdate[]> => {
  const updates: VerifiedUpdate[] = []
  if (commitPath.length === 0) return updates
  let prevRepo = baseRepo
  for (const commit of commitPath) {
    const nextRepo = await ReadableRepo.load(storage, commit)
    const diff = await DataDiff.of(nextRepo.data, prevRepo.data)

    if (nextRepo.did !== did) {
      throw new RepoVerificationError(`Invalid repo did: ${nextRepo.did}`)
    }
    if (!util.metaEqual(nextRepo.commit, prevRepo.commit)) {
      throw new RepoVerificationError('Not supported: repo metadata updated')
    }

    const validSig = await util.verifyCommitSig(nextRepo.commit, signingKey)
    if (!validSig) {
      throw new RepoVerificationError(
        `Invalid signature on commit: ${nextRepo.cid.toString()}`,
      )
    }

    const newCids = new CidSet([nextRepo.cid]).addSet(diff.newCids)

    updates.push({
      commit: nextRepo.cid,
      prev: prevRepo.cid,
      diff,
      newCids,
    })
    prevRepo = nextRepo
  }
  return updates
}

export const verifyProofs = async (
  proofs: Uint8Array,
  claims: RecordClaim[],
  did: string,
  didKey: string,
): Promise<{ verified: RecordClaim[]; unverified: RecordClaim[] }> => {
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
  const verified: RecordClaim[] = []
  const unverified: RecordClaim[] = []
  for (const claim of claims) {
    const found = await mst.get(
      util.formatDataKey(claim.collection, claim.rkey),
    )
    const record = found ? await blockstore.readObj(found, def.map) : null
    if (claim.record === null) {
      if (record === null) {
        verified.push(claim)
      } else {
        unverified.push(claim)
      }
    } else {
      const expected = await cidForCbor(claim.record)
      if (expected.equals(found)) {
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
