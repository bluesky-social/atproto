import * as ucan from 'ucans'
import { IpldStore, MicroblogDelegator } from '@adxp/common'
import * as auth from '@adxp/auth'

import server from '../src/server.js'
import Database from '../src/db/index.js'

export const newClient = async (url: string): Promise<MicroblogDelegator> => {
  const key = await ucan.EdKeypair.create()
  const authStore = await auth.AuthStore.fromTokens(key, [])
  await authStore.claimFull()
  return new MicroblogDelegator(url, key.did(), authStore)
}

export const runTestServer = async (port: number): Promise<void> => {
  const db = Database.memory()
  const serverBlockstore = IpldStore.createInMemory()
  await db.dropTables()
  await db.createTables()
  server(serverBlockstore, db, port)
}
