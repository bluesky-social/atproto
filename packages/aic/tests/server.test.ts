import { EcdsaKeypair } from '@adxp/crypto'
import AicClient from '../src/client'

describe('AIC server', () => {
  const client = new AicClient('http://localhost:26979')
  let signingKey: EcdsaKeypair
  let recoveryKey: EcdsaKeypair
  let aliceDid: string
  beforeAll(async () => {
    signingKey = await EcdsaKeypair.create()
    recoveryKey = await EcdsaKeypair.create()
  })

  it('registers a did', async () => {
    aliceDid = await client.createDid(
      signingKey,
      recoveryKey.did(),
      'alice.example.com',
      'example.com',
    )
  })

  it('retrieves the did doc', async () => {
    const doc = await client.getDocument(aliceDid)
    console.log(doc)
  })
})
