import { describe, expect, it } from 'vitest'
import {
  P256Keypair,
  P256_JWT_ALG,
  Secp256k1Keypair,
  formatDidKey,
} from '@atproto/crypto'
import type { DidString } from '@atproto/syntax'
import { SpaceKemError, decapsulate, encapsulate } from '../src/index.js'

const hex = (str: string) => new Uint8Array(Buffer.from(str, 'hex'))

describe('KEM', () => {
  it('derives the same shared secret on both sides', async () => {
    const author = await P256Keypair.create()
    const { keyShare, sharedSecret } = await encapsulate(
      author.did() as DidString,
    )
    expect(sharedSecret).toHaveLength(32)
    expect(decapsulate(author, keyShare)).toEqual(sharedSecret)
  })

  it('uses a fresh key share per encapsulation', async () => {
    const author = await P256Keypair.create()
    const a = await encapsulate(author.did() as DidString)
    const b = await encapsulate(author.did() as DidString)
    expect(a.keyShare).not.toBe(b.keyShare)
    expect(a.sharedSecret).not.toEqual(b.sharedSecret)
  })

  it('derives a different secret under a different author key', async () => {
    const author = await P256Keypair.create()
    const other = await P256Keypair.create()
    const { keyShare, sharedSecret } = await encapsulate(
      author.did() as DidString,
    )
    expect(decapsulate(other, keyShare)).not.toEqual(sharedSecret)
  })

  it('rejects a key that is not P-256', async () => {
    const k256 = await Secp256k1Keypair.create()
    await expect(encapsulate(k256.did() as DidString)).rejects.toThrow(
      SpaceKemError,
    )
    const author = await P256Keypair.create()
    expect(() => decapsulate(author, k256.did() as DidString)).toThrow(
      SpaceKemError,
    )
    expect(() => decapsulate(author, 'did:key:nope')).toThrow(SpaceKemError)
  })

  // The keys are from the export-only DHKEM(P-256, HKDF-SHA256) entry of the
  // HPKE test vectors (github.com/cfrg/draft-irtf-cfrg-hpke), where the syncer's
  // key share is `enc` and the author's KEM keypair is `skRm`. Those vectors use
  // a different `info`, so the expected secret was computed with Go's
  // crypto/hpke, using `info` "atproto-space-mac" and an empty exporter context.
  it('matches HPKE secret export', async () => {
    const enc = hex(
      '04d804370b7e24b94749eb1dc8df6d4d4a5d75f9effad01739ebcad5c54a40d57aaa8b4190fc124dbde2e4f1e1d1b012a3bc4038157dc29b55533a932306d8d38d',
    )
    const skRm = hex(
      '62c3868357a464f8461d03aa0182c7cebcde841036aea7230ddc7339f1088346',
    )
    const sharedSecret = hex(
      'f896b227296a19f87eeac264c7539506729fc78f07cdeee98434e8f89e869057',
    )

    const author = await P256Keypair.import(skRm)
    const keyShare = formatDidKey(P256_JWT_ALG, enc)
    expect(decapsulate(author, keyShare)).toEqual(sharedSecret)
  })
})
