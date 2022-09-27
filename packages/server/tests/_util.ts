import http from 'http'
import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import * as plc from '@adxp/plc'
import getPort from 'get-port'

import server, { DidTestRegistry, ServerConfig, Database } from '../src/index'

const USE_TEST_SERVER = true

export type CloseFn = () => Promise<void>

export type TestServerConfig = {
  usePlc: boolean
}

export const runTestServer = async (
  config: Partial<TestServerConfig> = {},
): Promise<{
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

  let plcServer: http.Server | undefined
  let plcDb: plc.Database | undefined
  let plcUrl = ''
  let serverDid: string
  let didTestRegistry: DidTestRegistry | undefined
  if (config.usePlc) {
    // run plc server
    const plcPort = await getPort()
    plcUrl = `http://localhost:${plcPort}`
    plcDb = await plc.Database.memory()
    plcServer = plc.server(plcDb, plcPort)

    // setup server did
    const plcClient = new plc.PlcClient(plcUrl)
    serverDid = await plcClient.createDid(
      keypair,
      keypair.did(),
      'pds.test',
      `http://localhost:${pdsPort}`,
    )
  } else {
    serverDid = 'did:test:pds'
    didTestRegistry = new DidTestRegistry()
  }

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
      didTestRegistry,
    }),
  )

  return {
    url: `http://localhost:${pdsPort}`,
    close: async () => {
      await db.close()
      s.close()
      plcServer?.close()
      await plcDb?.close()
    },
  }
}
