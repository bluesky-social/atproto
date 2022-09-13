import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'

import server from '../src/server'
import Database from '../src/db'

export type CloseFn = () => Promise<void>

export const runTestServer = async (port: number): Promise<CloseFn> => {
  const db = await Database.memory()
  const serverBlockstore = new MemoryBlockstore()
  const keypair = await crypto.EcdsaKeypair.create()
  const s = server(serverBlockstore, db, keypair, port)
  return async () => {
    await db.close()
    s.close()
  }
}
