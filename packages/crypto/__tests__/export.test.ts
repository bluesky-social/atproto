import EcdsaKeypair from '../src/p256/ecdsa'
import * as p256 from '../src/p256/operations'
import * as encoding from '../src/p256/encoding'

describe('exports and reimports keys', () => {
  let keypair: EcdsaKeypair
  let imported: EcdsaKeypair

  it('has the same DID', async () => {
    keypair = await EcdsaKeypair.create({ exportable: true })
    const exported = await keypair.export()
    imported = await EcdsaKeypair.import(exported, { exportable: true })

    expect(keypair.did()).toBe(imported.did())
  })

  it('produces a valid signature', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const sig = await imported.sign(data)

    const keyBytes = encoding.pubkeyBytesFromDid(keypair.did())

    const validSig = await p256.verify(keyBytes, data, sig)
    expect(validSig).toBeTruthy()
  })
})
