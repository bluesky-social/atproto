import { CID } from 'multiformats/cid'
import { DidResolver } from '@atproto/did-resolver'
import * as crypto from '@atproto/crypto'
import { ReadableBlockstore, RepoStorage } from './storage'
import DataDiff from './data-diff'
import SyncStorage from './storage/sync-storage'
import ReadableRepo from './readable-repo'
import Repo from './repo'
import CidSet from './cid-set'
import { parseRecordKey } from './util'
import { RepoContents } from './types'
import { def } from '@atproto/common'

export type VerifiedCheckout = {
  contents: RepoContents
  newCids: CidSet
}

export const verifyCheckout = async (
  storage: ReadableBlockstore,
  root: CID,
  didResolver: DidResolver,
): Promise<VerifiedCheckout> => {
  const repo = await ReadableRepo.load(storage, root)
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
    const { collection, rkey } = parseRecordKey(add.key)
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
  root: CID,
  didResolver: DidResolver,
): Promise<VerifiedUpdate[]> => {
  const commitPath = await storage.getCommitPath(root, null)
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

export class RepoVerificationError extends Error {}
