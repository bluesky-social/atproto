import getPort from 'get-port'
import { Secp256k1Keypair } from '@atproto/crypto'
import * as plc from '@did-plc/lib'
import { Database as DidPlcDb, PlcServer } from '@did-plc/server'
import { DidResolver, DidDocument } from '../src'
import { DidWebServer } from './web/server'
import DidWebDb from './web/db'

describe('did resolver', () => {
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

    const plcDB = DidPlcDb.mock()
    const plcPort = await getPort()
    const plcServer = PlcServer.create({ db: plcDB, port: plcPort })
    await plcServer.start()

    plcUrl = 'http://localhost:' + plcPort
    resolver = new DidResolver({ plcUrl })

    close = async () => {
      await webServer.close()
      await plcServer.destroy()
    }
  })

  afterAll(async () => {
    await close()
  })

  const handle = 'alice.test'
  const pds = 'https://service.test'
  let signingKey: Secp256k1Keypair
  let rotationKey: Secp256k1Keypair
  let webDid: string
  let plcDid: string
  let didWebDoc: DidDocument
  let didPlcDoc: DidDocument

  it('creates the did on did:web & did:plc', async () => {
    signingKey = await Secp256k1Keypair.create()
    rotationKey = await Secp256k1Keypair.create()
    const client = new plc.Client(plcUrl)
    plcDid = await client.createDid({
      signingKey: signingKey.did(),
      handle,
      pds,
      rotationKeys: [rotationKey.did()],
      signer: rotationKey,
    })
    didPlcDoc = await client.getDocument(plcDid)
    const domain = encodeURIComponent(`localhost:${webServer.port}`)
    webDid = `did:web:${domain}`
    didWebDoc = {
      ...didPlcDoc,
      id: webDid,
    }

    await webServer.put(didWebDoc)
  })

  it('resolve valid did:web', async () => {
    const didRes = await resolver.ensureResolve(webDid)
    expect(didRes).toEqual(didWebDoc)
  })

  it('resolve valid atpData from did:web', async () => {
    const atpData = await resolver.resolveAtprotoData(webDid)
    expect(atpData.did).toEqual(webDid)
    expect(atpData.handle).toEqual(handle)
    expect(atpData.pds).toEqual(pds)
    expect(atpData.signingKey).toEqual(signingKey.did())
    expect(atpData.handle).toEqual(handle)
  })

  it('throws on malformed did:webs', async () => {
    await expect(resolver.ensureResolve(`did:web:asdf`)).rejects.toThrow()
    await expect(resolver.ensureResolve(`did:web:`)).rejects.toThrow()
    await expect(resolver.ensureResolve(``)).rejects.toThrow()
  })

  it('throws on did:web with path components', async () => {
    await expect(
      resolver.ensureResolve(`did:web:example.com:u:bob`),
    ).rejects.toThrow()
  })

  it('resolve valid did:plc', async () => {
    const didRes = await resolver.ensureResolve(plcDid)
    expect(didRes).toEqual(didPlcDoc)
  })

  it('resolve valid atpData from did:plc', async () => {
    const atpData = await resolver.resolveAtprotoData(plcDid)
    expect(atpData.did).toEqual(plcDid)
    expect(atpData.handle).toEqual(handle)
    expect(atpData.pds).toEqual(pds)
    expect(atpData.signingKey).toEqual(signingKey.did())
    expect(atpData.handle).toEqual(handle)
  })

  it('throws on malformed did:plc', async () => {
    await expect(resolver.ensureResolve(`did:plc:asdf`)).rejects.toThrow()
    await expect(resolver.ensureResolve(`did:plc`)).rejects.toThrow()
  })
})
