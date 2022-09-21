import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'

import server, { DidTestRegistry } from '../src/server'
import Database from '../src/db'
import { ServerConfig } from '../src/config'

export type CloseFn = () => Promise<void>

export const runTestServer = async (port: number): Promise<CloseFn> => {
  const db = await Database.memory()
  const serverBlockstore = new MemoryBlockstore()
  const keypair = await crypto.EcdsaKeypair.create()
  const s = server(
    serverBlockstore,
    db,
    keypair,
    new ServerConfig({
      debugMode: true,
      scheme: 'http',
      hostname: 'localhost',
      port,
      didTestRegistry: new DidTestRegistry(),
    }),
  )
  return async () => {
    await db.close()
    s.close()
  }
}
