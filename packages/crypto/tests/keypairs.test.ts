import P256Keypair from '../src/p256/keypair'
import Secp256k1Keypair from '../src/secp256k1/keypair'
import * as p256 from '../src/p256/operations'
import * as secp from '../src/secp256k1/operations'
import { randomBytes } from '../src'

describe('keypairs', () => {
  describe('secp256k1', () => {
    let keypair: Secp256k1Keypair
    let imported: Secp256k1Keypair

    it('has the same DID on import', async () => {
      keypair = await Secp256k1Keypair.create({ exportable: true })
      const exported = await keypair.export()
      imported = await Secp256k1Keypair.import(exported, { exportable: true })

      expect(keypair.did()).toBe(imported.did())
    })

    it('produces a valid signature', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      const sig = await imported.sign(data)

      const validSig = await secp.verifyDidSig(keypair.did(), data, sig)

      expect(validSig).toBeTruthy()
    })

    it('produces a valid signature on a typed array of a large arraybuffer', async () => {
      const bytes = await randomBytes(8192)
      const arrBuf = bytes.buffer
      const sliceView = new Uint8Array(arrBuf, 1024, 1024)
      expect(sliceView.buffer.byteLength).toBe(8192)
      const sig = await imported.sign(sliceView)
      const validSig = await secp.verifyDidSig(keypair.did(), sliceView, sig)
      expect(validSig).toBeTruthy()
    })
  })

  describe('P-256', () => {
    let keypair: P256Keypair
    let imported: P256Keypair

    it('has the same DID on import', async () => {
      keypair = await P256Keypair.create({ exportable: true })
      const exported = await keypair.export()
      imported = await P256Keypair.import(exported, { exportable: true })

      expect(keypair.did()).toBe(imported.did())
    })

    it('produces a valid signature', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      const sig = await imported.sign(data)

      const validSig = await p256.verifyDidSig(keypair.did(), data, sig)

      expect(validSig).toBeTruthy()
    })

    it('produces a valid signature on a typed array of a large arraybuffer', async () => {
      const bytes = await randomBytes(8192)
      const arrBuf = bytes.buffer
      const sliceView = new Uint8Array(arrBuf, 1024, 1024)
      expect(sliceView.buffer.byteLength).toBe(8192)
      const sig = await imported.sign(sliceView)
      const validSig = await p256.verifyDidSig(keypair.did(), sliceView, sig)
      expect(validSig).toBeTruthy()
    })
  })
})
