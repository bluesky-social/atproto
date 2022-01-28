import { CID } from 'multiformats/cid'

const userRoots: {[did: string]: CID} = {}

// these fns will be async in the future
export const set = async (did: string, cid: CID): Promise<void> => {
  userRoots[did] = cid
}

export const get = async (did: string): Promise<CID | null> => {
  return userRoots[did] || null
}
