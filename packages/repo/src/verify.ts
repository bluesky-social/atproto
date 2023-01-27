import { CID } from 'multiformats/cid'
import { DidResolver } from '@atproto/did-resolver'
import * as crypto from '@atproto/crypto'
import { MemoryBlockstore, ReadableBlockstore, RepoStorage } from './storage'
import DataDiff from './data-diff'
import SyncStorage from './storage/sync-storage'
import ReadableRepo from './readable-repo'
import Repo from './repo'
import CidSet from './cid-set'
import * as util from './util'
import { RecordClaim, RepoContents } from './types'
import { def } from './types'
import { MST } from './mst'
import { cidForCbor } from '@atproto/common'

export type VerifiedCheckout = {
  contents: RepoContents
  newCids: CidSet
}

export const verifyCheckout = async (
  storage: ReadableBlockstore,
  head: CID,
  didResolver: DidResolver,
): Promise<VerifiedCheckout> => {
  const repo = await ReadableRepo.load(storage, head)
  const validSig = await didResolver.verifySignature(
    repo.did,
    repo.commit.root.bytes,
    repo.commit.sig,
  )
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${repo.cid.toString()}`,
    )
  }
  const diff = await DataDiff.of(repo.data, null)
  const newCids = new CidSet([
    repo.cid,
    repo.commit.root,
    repo.root.meta,
  ]).addSet(diff.newCids)

  const contents: RepoContents = {}
  for (const add of diff.addList()) {
    const { collection, rkey } = util.parseDataKey(add.key)
    if (!contents[collection]) {
      contents[collection] = {}
    }
    contents[collection][rkey] = await storage.readObj(add.cid, def.record)
  }

  return {
    contents,
    newCids,
  }
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
  didResolver: DidResolver,
): Promise<VerifiedUpdate[]> => {
  const commitPath = await storage.getCommitPath(head, null)
  if (commitPath === null) {
    throw new RepoVerificationError('Could not find shared history')
  } else if (commitPath.length < 1) {
    throw new RepoVerificationError('Expected at least one commit')
  }
  const baseRepo = await Repo.load(storage, commitPath[0])
  const baseDiff = await DataDiff.of(baseRepo.data, null)
  const baseRepoCids = new CidSet([
    baseRepo.cid,
    baseRepo.commit.root,
    baseRepo.root.meta,
  ]).addSet(baseDiff.newCids)
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
    didResolver,
  )
  return [init, ...updates]
}

export const verifyUpdates = async (
  repo: ReadableRepo,
  updateStorage: RepoStorage,
  updateRoot: CID,
  didResolver: DidResolver,
): Promise<VerifiedUpdate[]> => {
  const commitPath = await updateStorage.getCommitPath(updateRoot, repo.cid)
  if (commitPath === null) {
    throw new RepoVerificationError('Could not find shared history')
  }
  const syncStorage = new SyncStorage(updateStorage, repo.storage)
  return verifyCommitPath(repo, syncStorage, commitPath, didResolver)
}

export const verifyCommitPath = async (
  baseRepo: ReadableRepo,
  storage: ReadableBlockstore,
  commitPath: CID[],
  didResolver: DidResolver,
): Promise<VerifiedUpdate[]> => {
  const signingKey = await didResolver.resolveSigningKey(baseRepo.did)
  const updates: VerifiedUpdate[] = []
  if (commitPath.length === 0) return updates
  let prevRepo = baseRepo
  for (const commit of commitPath) {
    const nextRepo = await ReadableRepo.load(storage, commit)
    const diff = await DataDiff.of(nextRepo.data, prevRepo.data)

    if (!nextRepo.root.meta.equals(prevRepo.root.meta)) {
      throw new RepoVerificationError('Not supported: repo metadata updated')
    }

    // verify signature matches repo root + auth token
    const validSig = await crypto.verifySignature(
      signingKey,
      nextRepo.commit.root.bytes,
      nextRepo.commit.sig,
    )
    if (!validSig) {
      throw new RepoVerificationError(
        `Invalid signature on commit: ${nextRepo.cid.toString()}`,
      )
    }

    const newCids = new CidSet([nextRepo.cid, nextRepo.commit.root]).addSet(
      diff.newCids,
    )

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
  did: string,
  proofs: Uint8Array,
  claims: RecordClaim[],
  didResolver: DidResolver,
): Promise<{ verified: RecordClaim[]; unverified: RecordClaim[] }> => {
  const car = await util.readCar(proofs)
  const blockstore = new MemoryBlockstore(car.blocks)
  const commit = await blockstore.readObj(car.root, def.commit)
  const validSig = await didResolver.verifySignature(
    did,
    commit.root.bytes,
    commit.sig,
  )
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${car.root.toString()}`,
    )
  }
  const root = await blockstore.readObj(commit.root, def.repoRoot)
  const mst = MST.load(blockstore, root.data)
  const verified: RecordClaim[] = []
  const unverified: RecordClaim[] = []
  for (const claim of claims) {
    const found = await mst.get(
      util.formatDataKey(claim.collection, claim.rkey),
    )
    const record = found ? await blockstore.readObj(found, def.record) : null
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
  did: string,
  proofs: Uint8Array,
  didResolver: DidResolver,
): Promise<RecordClaim[]> => {
  const car = await util.readCar(proofs)
  const blockstore = new MemoryBlockstore(car.blocks)
  const commit = await blockstore.readObj(car.root, def.commit)
  const validSig = await didResolver.verifySignature(
    did,
    commit.root.bytes,
    commit.sig,
  )
  if (!validSig) {
    throw new RepoVerificationError(
      `Invalid signature on commit: ${car.root.toString()}`,
    )
  }
  const root = await blockstore.readObj(commit.root, def.repoRoot)
  const mst = MST.load(blockstore, root.data)

  const records: RecordClaim[] = []
  const leaves = await mst.reachableLeaves()
  for (const leaf of leaves) {
    const { collection, rkey } = util.parseDataKey(leaf.key)
    const record = await blockstore.attemptRead(leaf.value, def.record)
    if (record) {
      records.push({
        collection,
        rkey,
        record: record.obj,
      })
    }
  }
  return records
}

export class RepoVerificationError extends Error {}
