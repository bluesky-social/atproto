import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import * as plc from '@adxp/plc'
import getPort from 'get-port'
import * as uint8arrays from 'uint8arrays'

import server, { ServerConfig, Database, App } from '../src/index'

const USE_TEST_SERVER = true

const ADMIN_PASSWORD = 'admin-pass'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  url: string
  app?: App
  close: CloseFn
}

export const runTestServer = async (
  params: Partial<ServerConfig> = {},
): Promise<TestServerInfo> => {
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
  const plcDb = plc.Database.memory()
  await plcDb.createTables()
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
  const { app, listener } = server(
    serverBlockstore,
    db,
    keypair,
    new ServerConfig({
      debugMode: true,
      scheme: 'http',
      hostname: 'localhost',
      port: pdsPort,
      serverDid,
      adminPassword: ADMIN_PASSWORD,
      inviteRequired: false,
      didPlcUrl: plcUrl,
      jwtSecret: 'jwt-secret',
      testNameRegistry: {},
      appUrlPasswordReset: 'app://forgot-password',
      emailNoReplyAddress: 'noreply@blueskyweb.xyz',
      ...params,
    }),
  )

  return {
    url: `http://localhost:${pdsPort}`,
    app,
    close: async () => {
      await Promise.all([
        db.close(),
        listener.close(),
        plcServer?.close(),
        plcDb?.close(),
      ])
    },
  }
}

export const adminAuth = () => {
  return (
    'Basic ' +
    uint8arrays.toString(
      uint8arrays.fromString('admin:' + ADMIN_PASSWORD, 'utf8'),
      'base64pad',
    )
  )
}
