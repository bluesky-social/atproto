import { EcdsaKeypair } from '@adxp/crypto'
import PlcClient from '../src/client'
import * as document from '../src/lib/document'

describe('PLC server', () => {
  const client = new PlcClient('http://localhost:26979')
  let signingKey: EcdsaKeypair
  let recoveryKey: EcdsaKeypair
  let did: string
  let username = 'alice.example.com'
  let atpPds = 'example.com'

  beforeAll(async () => {
    signingKey = await EcdsaKeypair.create()
    recoveryKey = await EcdsaKeypair.create()
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
    expect(operation).rejects.toThrow()
  })
})
