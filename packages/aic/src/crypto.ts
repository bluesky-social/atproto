import { JsonWebKey } from 'crypto'
import { EcdsaKeypair, verifyDidSig } from '@adxp/crypto'
import { Asymmetric } from './types'

export async function createAsymmetric(jwk: JsonWebKey): Promise<Asymmetric> {
  const key = await EcdsaKeypair.import(jwk, {
    exportable: true,
  })
  return {
    key,
    did: (): string => {
      return key.did()
    },
    sign: async (msg: Uint8Array): Promise<Uint8Array> => {
      return await key.sign(msg)
    },
    verifyDidSig,
  }
}
