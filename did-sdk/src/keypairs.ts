import { randomBytes } from 'crypto'
import { LdKeyPairInstance } from '@transmute/ld-key-pair'
import { Ed25519KeyPair } from '@transmute/did-key-ed25519'
import { Secp256k1KeyPair } from '@transmute/did-key-secp256k1'

// TODO needed?
// import * as base58btc from 'base58-universal'

// const ED_VERIFICATION_SUITE_ID = 'Ed25519VerificationKey2020'
// const MULTIBASE_BASE58BTC_HEADER = 'z' // multibase base58-btc header
// const MULTICODEC_ED25519_PUB_HEADER = new Uint8Array([0xed, 0x01]) // multicodec ed25519-pub header as varint
// const MULTICODEC_ED25519_PRIV_HEADER = new Uint8Array([0x80, 0x26]) // multicodec ed25519-priv header as varint

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

export async function generateKeyPair(type = ''): Promise<KeyPair> {
  switch (type) {
    case 'Ed25519':
    case 'EdDSA':
      return await _generateKeyPair(
        await Ed25519KeyPair.generate({ secureRandom: () => randomBytes(32) }),
      )

    case 'secp256k1':
    case 'ES256K':
    default:
      return await _generateKeyPair(
        await Secp256k1KeyPair.generate({
          secureRandom: () => randomBytes(32),
        }),
      )
  }
}

// TODO: signing and signature-verification functions

// TODO needed?
// export const multibase = {
//   isHeaderValid(key: string, expectedHeader: Uint8Array): boolean {
//     if (typeof key !== 'string' || key[0] !== MULTIBASE_BASE58BTC_HEADER) {
//       return false
//     }

//     const keyBytes = multibase.decode(key)
//     return expectedHeader.every((val, i) => keyBytes[i] === val)
//   },

//   encode(header: Uint8Array, key: Uint8Array): string {
//     const buf = new Uint8Array(header.length + key.length)
//     buf.set(header)
//     buf.set(key, header.length)
//     return MULTIBASE_BASE58BTC_HEADER + base58btc.encode(buf)
//   },

//   decode(key: string): Uint8Array {
//     return base58btc.decode(key.slice(1))
//   },
// }
