import { CID } from 'multiformats/cid'
import * as auth from '@atproto/auth'
import { IpldStore } from './blockstore'
import { RepoStructure } from './structure'
import { DataDiff } from './mst'
import * as util from './util'
import { def } from './types'

export const verifyUpdates = async (
  blockstore: IpldStore,
  earliest: CID | null,
  latest: CID,
  verifier: auth.Verifier,
): Promise<DataDiff> => {
  const commitPath = await util.getCommitPath(blockstore, earliest, latest)
  if (commitPath === null) {
    throw new Error('Could not find shared history')
  }
  const fullDiff = new DataDiff()
  if (commitPath.length === 0) return fullDiff
  let prevRepo = await RepoStructure.load(blockstore, commitPath[0])
  for (const commit of commitPath.slice(1)) {
    const nextRepo = await RepoStructure.load(blockstore, commit)
    const diff = await prevRepo.data.diff(nextRepo.data)

    if (!nextRepo.root.meta.equals(prevRepo.root.meta)) {
      throw new Error('Not supported: repo metadata updated')
    }

    let didForSignature: string
    if (nextRepo.root.auth_token) {
      // verify auth token covers all necessary writes
      const encodedToken = await blockstore.get(
        nextRepo.root.auth_token,
        def.string,
      )
      const token = await verifier.validateUcan(encodedToken)
      const neededCaps = diff.neededCapabilities(prevRepo.did())
      for (const cap of neededCaps) {
        await verifier.verifyAtpUcan(token, prevRepo.did(), cap)
      }
      didForSignature = token.payload.iss
    } else {
      didForSignature = prevRepo.did()
    }

    // verify signature matches repo root + auth token
    // const commit = await toRepo.getCommit()
    const validSig = await verifier.verifySignature(
      didForSignature,
      nextRepo.commit.root.bytes,
      nextRepo.commit.sig,
    )
    if (!validSig) {
      throw new Error(`Invalid signature on commit: ${nextRepo.cid.toString()}`)
    }

    fullDiff.addDiff(diff)
    prevRepo = nextRepo
  }
  return fullDiff
}
