import * as ucan from 'ucans'
import { IpldStore, MicroblogDelegator, auth } from '@adxp/common'

import server from '../src/server.js'
import Database from '../src/db/index.js'

export const newClient = async (url: string): Promise<MicroblogDelegator> => {
  const key = await ucan.EdKeypair.create()
  const token = await auth.claimFull(key.did(), key)
  const ucans = await ucan.Store.fromTokens([token.encoded()])
  return new MicroblogDelegator(url, key.did(), key, ucans)
}

export const runTestServer = async (port: number): Promise<void> => {
  const db = Database.memory()
  const serverBlockstore = IpldStore.createInMemory()
  await db.dropTables()
  await db.createTables()
  server(serverBlockstore, db, port)
}
