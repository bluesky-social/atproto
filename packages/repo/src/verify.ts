import { CID } from 'multiformats/cid'
import { DidResolver } from '@atproto/did-resolver'
import { ReadableBlockstore } from './storage'
import Repo from './repo'
import { DataDiff } from './mst'

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

export const verifyUpdates = async (
  storage: ReadableBlockstore,
  latest: CID,
  earliest: CID | null,
  didResolver: DidResolver,
): Promise<DataDiff> => {
  const commitPath = await storage.getCommitPath(latest, earliest)
  if (commitPath === null) {
    throw new RepoVerificationError('Could not find shared history')
  }
  const fullDiff = new DataDiff()
  if (commitPath.length === 0) return fullDiff
  let prevRepo = await Repo.load(storage, commitPath[0])
  for (const commit of commitPath.slice(1)) {
    const nextRepo = await Repo.load(storage, commit)
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

    fullDiff.addDiff(diff)
    prevRepo = nextRepo
  }
  return fullDiff
}

export class RepoVerificationError extends Error {}
