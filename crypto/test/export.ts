import test from 'ava'

import EcdsaKeypair from '../src/ecdsa.js'
import { verifyEcdsaSig } from '../src/verify.js'

test('can export and reimport key', async (t) => {
  const keypair = await EcdsaKeypair.create({ exportable: true })
  const exported = await keypair.export()
  const imported = await EcdsaKeypair.import(exported, { exportable: true })

  t.is(keypair.did(), imported.did(), 'They have the same DID')

  const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  const sig = await imported.sign(data)

  const validSig = await verifyEcdsaSig(data, sig, keypair.did())
  t.is(true, validSig, 'It produced a valid signature')
})
