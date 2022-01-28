const userDids: {[username: string]: string} = {}

// these fns will be async in the future
export const set = async (username: string, did: string): Promise<void> => {
  userDids[username] = did
}

export const get = async (username: string): Promise<string | null> => {
  return userDids[username] || null
}

export const listDids = async (): Promise<string[]> => {
  return Object.values(userDids)
}
