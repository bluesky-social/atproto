import { IpldStore, MicroblogDelegator } from '@adxp/common'
import * as auth from '@adxp/auth'
import * as crypto from '@adxp/crypto'

import server from '../src/server'
import Database from '../src/db/index'

export const newClient = async (url: string): Promise<MicroblogDelegator> => {
  const keypair = await crypto.EcdsaKeypair.create()
  const authStore = await auth.AuthStore.fromTokens(keypair, [])
  await authStore.claimFull()
  return new MicroblogDelegator(url, keypair.did(), authStore)
}

export type CloseFn = () => Promise<void>

export const runTestServer = async (port: number): Promise<CloseFn> => {
  const db = Database.memory()
  const serverBlockstore = IpldStore.createInMemory()
  const keypair = await crypto.EcdsaKeypair.create()
  await db.dropTables()
  await db.createTables()
  const s = server(serverBlockstore, db, keypair, port)
  return async () => {
    await db.close()
    s.close()
  }
}
