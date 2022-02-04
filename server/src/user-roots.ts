import level from 'level'
import { CID } from 'multiformats/cid'

const store = level('user_roots')

// these fns will be async in the future
export const set = async (did: string, cid: CID): Promise<void> => {
  await store.put(did, cid.toString())
}

export const get = async (did: string): Promise<CID | null> => {
  try {
    const got = await store.get(did)
    return CID.parse(got) || null
  } catch(err: any) {
    if (err.notFound) {
      return null
    }
    throw err
  }
}
