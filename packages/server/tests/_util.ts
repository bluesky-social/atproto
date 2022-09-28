import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import * as plc from '@adxp/plc'
import getPort from 'get-port'

import server, { ServerConfig, Database } from '../src/index'

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
  const pdsPort = await getPort()
  const keypair = await crypto.EcdsaKeypair.create()

  // run plc server
  const plcPort = await getPort()
  const plcUrl = `http://localhost:${plcPort}`
  const plcDb = await plc.Database.memory()
  const plcServer = plc.server(plcDb, plcPort)

  // setup server did
  const plcClient = new plc.PlcClient(plcUrl)
  const serverDid = await plcClient.createDid(
    keypair,
    keypair.did(),
    'pds.test',
    `http://localhost:${pdsPort}`,
  )

  const db = await Database.memory()
  const serverBlockstore = new MemoryBlockstore()
  const s = server(
    serverBlockstore,
    db,
    keypair,
    new ServerConfig({
      debugMode: true,
      scheme: 'http',
      hostname: 'localhost',
      port: pdsPort,
      serverDid,
      didPlcUrl: plcUrl,
      jwtSecret: 'jwt-secret',
      testNameRegistry: {},
    }),
  )

  return {
    url: `http://localhost:${pdsPort}`,
    close: async () => {
      await Promise.all([
        db.close(),
        s.close(),
        plcServer?.close(),
        plcDb?.close(),
      ])
    },
  }
}
