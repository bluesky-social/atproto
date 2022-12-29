import { CID } from 'multiformats/cid'
import { DidResolver } from '@atproto/did-resolver'
import { RepoStorage } from './storage'
import { DataDiff } from './mst'
import SyncStorage from './storage/sync-storage'
import ReadableRepo from './readable-repo'

// type RecordsMap = { [key: string]: CID }

// export const verifyCheckout = async (
//   storage: ReadableBlockstore,
//   root: CID,
//   didResolver: DidResolver,
// ): Promise<RecordsMap> => {
//   const repo = await Repo.load(storage, root)
//   const validSig = await didResolver.verifySignature(
//     repo.did,
//     repo.commit.root.bytes,
//     repo.commit.sig,
//   )
//   if (!validSig) {
//     throw new RepoVerificationError(
//       `Invalid signature on commit: ${repo.cid.toString()}`,
//     )
//   }
//   const entries = await repo.data.list()
//   const entryCids = entries.map((entry) => entry.value)
//   const missing = await storage.checkMissing(entryCids)
//   const map: RecordsMap = {}
//   for (const entyr of entries) { }
//   return map
//   return entries.

//   return entries.
// }

type RepoUpdate = {
  root: CID
  prev: CID
  diff: DataDiff
}

export const verifyUpdates = async (
  repo: ReadableRepo,
  updateStorage: RepoStorage,
  updateRoot: CID,
  didResolver: DidResolver,
): Promise<RepoUpdate[]> => {
  const commitPath = await updateStorage.getCommitPath(updateRoot, repo.cid)
  if (commitPath === null) {
    throw new RepoVerificationError('Could not find shared history')
  }
  const updates: RepoUpdate[] = []
  if (commitPath.length === 0) return updates
  const syncStorage = new SyncStorage(updateStorage, repo.storage)
  let prevRepo = repo
  for (const commit of commitPath.slice(1)) {
    const nextRepo = await ReadableRepo.load(syncStorage, commit)
    const diff = await prevRepo.data.diff(nextRepo.data)

    if (!nextRepo.root.meta.equals(prevRepo.root.meta)) {
      throw new RepoVerificationError('Not supported: repo metadata updated')
    }

    // verify signature matches repo root + auth token
    const validSig = await didResolver.verifySignature(
      nextRepo.did,
      nextRepo.commit.root.bytes,
      nextRepo.commit.sig,
    )
    if (!validSig) {
      throw new RepoVerificationError(
        `Invalid signature on commit: ${nextRepo.cid.toString()}`,
      )
    }

    updates.push({
      root: nextRepo.cid,
      prev: prevRepo.cid,
      diff,
    })
    prevRepo = nextRepo
  }
  return updates
}

export class RepoVerificationError extends Error {}
