import { describe, expect, it } from 'vitest'
import {
  P256Keypair,
  P256_JWT_ALG,
  Secp256k1Keypair,
  formatDidKey,
} from '@atproto/crypto'
import type { DidString } from '@atproto/syntax'
import { decapsulate, encapsulate } from './kem.js'

const hex = (str: string) => new Uint8Array(Buffer.from(str, 'hex'))

const author = await P256Keypair.create()
const authorKemKey = author.did() as DidString
const k256Key = (await Secp256k1Keypair.create()).did() as DidString

describe(encapsulate, () => {
  it('derives the shared secret the author decapsulates', async () => {
    const { keyShare, sharedSecret } = await encapsulate(authorKemKey)
    expect(sharedSecret).toHaveLength(32)
    expect(decapsulate(author, keyShare)).toEqual(sharedSecret)
  })

  it('uses a fresh key share per encapsulation', async () => {
    const a = await encapsulate(authorKemKey)
    const b = await encapsulate(authorKemKey)
    expect(a.keyShare).not.toBe(b.keyShare)
    expect(a.sharedSecret).not.toEqual(b.sharedSecret)
  })

  it('rejects an author key that is not P-256', async () => {
    await expect(encapsulate(k256Key)).rejects.toThrow(
      /KEM key must be a P-256 did:key/,
    )
  })
})

describe(decapsulate, () => {
  it('derives another secret under another author key', async () => {
    const other = await P256Keypair.create()
    const { keyShare, sharedSecret } = await encapsulate(authorKemKey)
    expect(decapsulate(other, keyShare)).not.toEqual(sharedSecret)
  })

  it.each([
    {
      note: 'is not P-256',
      keyShare: k256Key,
      message: /KEM key must be a P-256 did:key/,
    },
    {
      note: 'does not parse',
      keyShare: 'did:key:nope' as DidString,
      message: /invalid KEM key/,
    },
  ])('rejects a key share that $note', ({ keyShare, message }) => {
    expect(() => decapsulate(author, keyShare)).toThrow(message)
  })

  // The keys are from the export-only DHKEM(P-256, HKDF-SHA256) entry of the
  // HPKE test vectors (github.com/cfrg/draft-irtf-cfrg-hpke), where the syncer's
  // key share is `enc` and the author's KEM keypair is `skRm`. Those vectors use
  // a different `info`, so the expected secret was computed with Go's
  // crypto/hpke, using `info` "atproto-mac" and an empty exporter context.
  it('matches HPKE secret export', async () => {
    const enc = hex(
      '04d804370b7e24b94749eb1dc8df6d4d4a5d75f9effad01739ebcad5c54a40d57aaa8b4190fc124dbde2e4f1e1d1b012a3bc4038157dc29b55533a932306d8d38d',
    )
    const skRm = hex(
      '62c3868357a464f8461d03aa0182c7cebcde841036aea7230ddc7339f1088346',
    )
    const sharedSecret = hex(
      '2060e0558d1b34c10086bc137f849bb79ba59fcdc30544418e35c9cd301f0d0d',
    )

    const kemKey = await P256Keypair.import(skRm)
    expect(decapsulate(kemKey, formatDidKey(P256_JWT_ALG, enc))).toEqual(
      sharedSecret,
    )
  })
})
