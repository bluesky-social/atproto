import getPort from 'get-port'
import { AtpData, DidResolver } from '../src'
import { DidWebServer } from '../src/web/server'
import DidWebDb from '../src/web/db'
import {
  Database as DidPlcDb,
  server as runPlcServer,
  PlcClient,
} from '@atproto/plc'
import { DIDDocument } from 'did-resolver'
import { EcdsaKeypair } from '@atproto/crypto'

describe('resolver', () => {
  let close: () => Promise<void>
  let webServer: DidWebServer
  let plcUrl: string
  let resolver: DidResolver

  beforeAll(async () => {
    const webDb = DidWebDb.memory()
    webServer = DidWebServer.create(webDb, await getPort())
    await new Promise((resolve, reject) => {
      webServer._httpServer?.on('listening', resolve)
      webServer._httpServer?.on('error', reject)
    })

    const plcDB = DidPlcDb.memory()
    await plcDB.createTables()
    const plcPort = await getPort()
    const plcServer = await runPlcServer(plcDB, plcPort)

    plcUrl = 'http://localhost:' + plcPort
    resolver = new DidResolver({ plcUrl })

    close = async () => {
      await webServer.close()
      await plcDB.close()
      await plcServer.close()
    }
  })

  afterAll(async () => {
    await close()
  })

  let webDid: string
  let plcDid: string
  let didWebDoc: DIDDocument
  let didPlcDoc: DIDDocument
  let didWebData: AtpData
  let didPlcData: AtpData

  it('creates the did on did:web & did:plc', async () => {
    const signingKey = await EcdsaKeypair.create()
    const recoveryKey = await EcdsaKeypair.create()
    const username = 'alice.test'
    const pds = 'https://service.test'
    const client = new PlcClient(plcUrl)
    plcDid = await client.createDid(
      signingKey,
      recoveryKey.did(),
      username,
      pds,
    )
    didPlcDoc = await client.getDocument(plcDid)
    const domain = encodeURIComponent(`localhost:${webServer.port}`)
    webDid = `did:web:${domain}`
    didWebDoc = {
      ...didPlcDoc,
      id: webDid,
    }

    didPlcData = await client.getDocumentData(plcDid)
    didWebData = {
      ...didPlcData,
      did: webDid,
    }

    await webServer.put(didWebDoc)
  })

  it('resolve valid did:web', async () => {
    const didRes = await resolver.ensureResolveDid(webDid)
    expect(didRes).toEqual(didWebDoc)
  })

  it('resolve valid atpData from did:web', async () => {
    const atpData = await resolver.resolveAtpData(webDid)
    expect(atpData).toEqual(didWebData)
  })

  it('throws on malformed did:webs', async () => {
    await expect(resolver.ensureResolveDid(`did:web:asdf`)).rejects.toThrow()
    await expect(resolver.ensureResolveDid(`did:web:`)).rejects.toThrow()
    await expect(resolver.ensureResolveDid(``)).rejects.toThrow()
  })

  it('resolve valid did:plc', async () => {
    const didRes = await resolver.ensureResolveDid(plcDid)
    expect(didRes).toEqual(didPlcDoc)
  })

  it('resolve valid atpData from did:plc', async () => {
    const atpData = await resolver.resolveAtpData(plcDid)
    expect(atpData).toEqual(didPlcData)
  })

  it('throws on malformed did:plc', async () => {
    await expect(resolver.ensureResolveDid(`did:plc:asdf`)).rejects.toThrow()
    await expect(resolver.ensureResolveDid(`did:plc`)).rejects.toThrow()
  })
})
