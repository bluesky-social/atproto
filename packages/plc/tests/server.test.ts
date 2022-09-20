import { EcdsaKeypair } from '@adxp/crypto'
import PlcClient from '../src/client'
import * as document from '../src/lib/document'
import getPort from 'get-port'
import * as util from './util'
import { cidForData } from '@adxp/common'

const USE_TEST_SERVER = false

describe('PLC server', () => {
  let username = 'alice.example.com'
  let atpPds = 'example.com'

  let closeFn: util.CloseFn | null = null
  let client: PlcClient

  let signingKey: EcdsaKeypair
  let recoveryKey: EcdsaKeypair

  let did: string

  beforeAll(async () => {
    let port: number
    if (USE_TEST_SERVER) {
      port = await getPort()
      closeFn = await util.runTestServer(port)
    } else {
      port = 2582
    }

    client = new PlcClient(`http://localhost:${port}`)

    signingKey = await EcdsaKeypair.create()
    recoveryKey = await EcdsaKeypair.create()
  })

  afterAll(async () => {
    if (closeFn) {
      await closeFn()
    }
  })

  it('registers a did', async () => {
    did = await client.createDid(
      signingKey,
      recoveryKey.did(),
      username,
      atpPds,
    )
  })

  it('retrieves the did doc', async () => {
    const doc = await client.getDocumentData(did)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.atpPds).toEqual(atpPds)
  })

  it('can perform some updates', async () => {
    const newSigningKey = await EcdsaKeypair.create()
    const newRecoveryKey = await EcdsaKeypair.create()

    await client.rotateSigningKey(did, newSigningKey.did(), signingKey)
    signingKey = newSigningKey

    await client.rotateRecoveryKey(did, newRecoveryKey.did(), signingKey)
    recoveryKey = newRecoveryKey

    username = 'ali.example2.com'
    await client.updateUsername(did, username, signingKey)

    atpPds = 'example2.com'
    await client.updateAtpPds(did, atpPds, signingKey)

    const doc = await client.getDocumentData(did)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.atpPds).toEqual(atpPds)
  })

  it('retrieves the operation log', async () => {
    const doc = await client.getDocumentData(did)
    const ops = await client.getOperationLog(did)
    const computedDoc = await document.validateOperationLog(did, ops)
    expect(computedDoc).toEqual(doc)
  })

  it('rejects on bad updates', async () => {
    const newKey = await EcdsaKeypair.create()
    const operation = client.rotateRecoveryKey(did, newKey.did(), newKey)
    await expect(operation).rejects.toThrow()
  })

  it('allows for recovery through a forked history', async () => {
    const attackerKey = await EcdsaKeypair.create()
    await client.rotateSigningKey(did, attackerKey.did(), signingKey)
    await client.rotateRecoveryKey(did, attackerKey.did(), attackerKey)

    const newKey = await EcdsaKeypair.create()
    const ops = await client.getOperationLog(did)
    const forkPoint = ops[ops.length - 3]
    const forkCid = await cidForData(forkPoint)
    await client.rotateSigningKey(did, newKey.did(), recoveryKey, forkCid)
    signingKey = newKey

    const doc = await client.getDocumentData(did)
    expect(doc.did).toEqual(did)
    expect(doc.signingKey).toEqual(signingKey.did())
    expect(doc.recoveryKey).toEqual(recoveryKey.did())
    expect(doc.username).toEqual(username)
    expect(doc.atpPds).toEqual(atpPds)
  })

  it('handles concurrent requests', async () => {
    const COUNT = 100
    const keys: EcdsaKeypair[] = []
    for (let i = 0; i < COUNT; i++) {
      keys.push(await EcdsaKeypair.create())
    }
    await Promise.all(
      keys.map(async (key, index) => {
        await client.createDid(key, key.did(), `user${index}`, `example.com`)
      }),
    )
  })
})
