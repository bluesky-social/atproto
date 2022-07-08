import { LdKeyPairInstance } from '@transmute/ld-key-pair'
import { Ed25519KeyPair } from '@transmute/did-key-ed25519'
import { Secp256k1KeyPair } from '@transmute/did-key-secp256k1'
import { secureRandom as rand } from '../crypto'

export type KeyType = 'ed25519' | 'secp256k1'
export type generateFromSeedOptions = { secureRandom?: () => Buffer }

export interface KeyPair {
  publicJwk: any
  privateJwk: any
}

async function _generateKeyPair(keyPair: LdKeyPairInstance) {
  const { publicKeyJwk, privateKeyJwk } = await keyPair.export({
    type: 'JsonWebKey2020',
    privateKey: true,
  })
  return {
    publicJwk: publicKeyJwk,
    privateJwk: privateKeyJwk,
  }
}

export async function generateKeyPair(
  type: KeyType,
  opts?: generateFromSeedOptions,
): Promise<KeyPair> {
  const secureRandom = opts?.secureRandom ?? (() => rand(32))
  switch (type) {
    case 'ed25519':
      return await _generateKeyPair(
        await Ed25519KeyPair.generate({ secureRandom }),
      )

    case 'secp256k1':
      return await _generateKeyPair(
        await Secp256k1KeyPair.generate({ secureRandom }),
      )
  }
}
