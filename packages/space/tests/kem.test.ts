import { describe, expect, it } from 'vitest'
import {
  P256Keypair,
  P256_JWT_ALG,
  Secp256k1Keypair,
  formatDidKey,
} from '@atproto/crypto'
import { SpaceMacError, decapsulate, encapsulate } from '../src/index.js'

const hex = (str: string) => new Uint8Array(Buffer.from(str, 'hex'))

describe('KEM', () => {
  it('derives the same shared secret on both sides', async () => {
    const author = await P256Keypair.create()
    const { keyShare, sharedSecret } = await encapsulate(author.did())
    expect(sharedSecret).toHaveLength(32)
    expect(decapsulate(author, keyShare)).toEqual(sharedSecret)
  })

  it('uses a fresh key share per encapsulation', async () => {
    const author = await P256Keypair.create()
    const a = await encapsulate(author.did())
    const b = await encapsulate(author.did())
    expect(a.keyShare).not.toBe(b.keyShare)
    expect(a.sharedSecret).not.toEqual(b.sharedSecret)
  })

  it('derives a different secret under a different author key', async () => {
    const author = await P256Keypair.create()
    const other = await P256Keypair.create()
    const { keyShare, sharedSecret } = await encapsulate(author.did())
    expect(decapsulate(other, keyShare)).not.toEqual(sharedSecret)
  })

  it('rejects a key that is not P-256', async () => {
    const k256 = await Secp256k1Keypair.create()
    await expect(encapsulate(k256.did())).rejects.toThrow(SpaceMacError)
    const author = await P256Keypair.create()
    expect(() => decapsulate(author, k256.did())).toThrow(SpaceMacError)
    expect(() => decapsulate(author, 'did:key:nope')).toThrow(SpaceMacError)
  })

  // RFC 9180 §A.3.1, DHKEM(P-256, HKDF-SHA256): the syncer's key share is `pkEm`
  // and the author's KEM keypair is `skRm`.
  it('matches the RFC 9180 test vector', async () => {
    const pkEm = hex(
      '04a92719c6195d5085104f469a8b9814d5838ff72b60501e2c4466e5e67b325ac98536d7b61a1af4b78e5b7f951c0900be863c403ce65c9bfcb9382657222d18c4',
    )
    const skRm = hex(
      'f3ce7fdae57e1a310d87f1ebbde6f328be0a99cdbcadf4d6589cf29de4b8ffd2',
    )
    const sharedSecret = hex(
      'c0d26aeab536609a572b07695d933b589dcf363ff9d93c93adea537aeabb8cb8',
    )

    const author = await P256Keypair.import(skRm)
    const keyShare = formatDidKey(P256_JWT_ALG, pkEm)
    expect(decapsulate(author, keyShare)).toEqual(sharedSecret)
  })
})
