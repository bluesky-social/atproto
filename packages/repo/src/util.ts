import { CID } from 'multiformats/cid'
import * as auth from '@atproto/auth'
import { DataStore } from './types'
import { IpldStore } from './blockstore'
import { def } from './types'

export const ucanForOperation = async (
  prevData: DataStore,
  newData: DataStore,
  rootDid: string,
  authStore: auth.AuthStore,
): Promise<string> => {
  const diff = await prevData.diff(newData)
  const neededCaps = diff.neededCapabilities(rootDid)
  const ucanForOp = await authStore.createUcanForCaps(rootDid, neededCaps, 30)
  return auth.encodeUcan(ucanForOp)
}
export const getCommitPath = async (
  blockstore: IpldStore,
  earliest: CID | null,
  latest: CID,
): Promise<CID[] | null> => {
  let curr: CID | null = latest
  const path: CID[] = []
  while (curr !== null) {
    path.push(curr)
    const commit = await blockstore.get(curr, def.commit)
    if (earliest && curr.equals(earliest)) {
      return path.reverse()
    }
    const root = await blockstore.get(commit.root, def.repoRoot)
    if (!earliest && root.prev === null) {
      return path.reverse()
    }
    curr = root.prev
  }
  return null
}
