import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import getPort from 'get-port'

import server, { DidTestRegistry, ServerConfig, Database } from '../src/index'

const USE_TEST_SERVER = true

export type CloseFn = () => Promise<void>

export const runTestServer = async (): Promise<{
  url: string
  close: CloseFn
}> => {
  if (!USE_TEST_SERVER) {
    return {
      url: 'http://localhost:2583',
      close: async () => {},
    }
  }
  const port = await getPort()
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
      jwtSecret: 'jwt-secret',
      didTestRegistry: new DidTestRegistry(),
    }),
  )
  return {
    url: `http://localhost:${port}`,
    close: async () => {
      await db.close()
      s.close()
    },
  }
}
