import level from 'level'

const store = level('user_dids')

export const set = async (username: string, did: string): Promise<void> => {
  await store.put(username, did)
}

export const get = async (username: string): Promise<string | null> => {
  try {
    const got = await store.get(username)
    return got || null
  } catch(err: any) {
    if (err.notFound) {
      return null
    }
    throw err
  }
}

// @@TODO: we shouldn't ever iterate over our entire user store
// this is a stand in until we have social graphs
export const listDids = async (): Promise<string[]> => {
  const dids = []
  // @ts-ignore we're pretty sure that's actually an iterator, not sure how to make typescript happy -prf
  for await (const [_, did] of store.iterator()) {
    dids.push(did)
  }
  return dids
}
