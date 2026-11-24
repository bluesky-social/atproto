import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { P256Keypair } from '@atproto/crypto'
import { SpaceTokenError, createSpaceCredential } from '@atproto/space'
import type { DidString } from '@atproto/syntax'
import { SpaceCredential } from './space-credential.js'

const SPACE = 'at:space/did:plc:authority/com.example.group/test'
const ISSUED_AT = 1_700_000_000 // seconds

async function mintCredential(key: P256Keypair, expiresInSec = 600) {
  return createSpaceCredential({
    iss: 'did:plc:authority',
    sub: SPACE,
    keyId: key.did() as DidString,
    keypair: await P256Keypair.create(),
    expiresInSec,
  })
}

describe(SpaceCredential, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: ISSUED_AT * 1e3 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects a credential bound to another key', async () => {
    const token = await mintCredential(await P256Keypair.create())
    const otherKey = await P256Keypair.create()
    expect(() => SpaceCredential.parse(token, otherKey)).toThrow(
      expect.objectContaining({
        name: SpaceTokenError.name,
        code: 'BadJwtCnf',
      }),
    )
  })

  it('renews a minute before expiry', async () => {
    const key = await P256Keypair.create()
    const credential = SpaceCredential.parse(await mintCredential(key), key)
    expect(credential.renewAt).toBe(ISSUED_AT + 600 - 60)

    vi.setSystemTime((ISSUED_AT + 539) * 1e3)
    expect(credential.needsRenewal).toBe(false)
    vi.setSystemTime((ISSUED_AT + 540) * 1e3)
    expect(credential.needsRenewal).toBe(true)
  })

  it('renews short-lived credentials halfway through', async () => {
    const key = await P256Keypair.create()
    const credential = SpaceCredential.parse(await mintCredential(key, 10), key)
    expect(credential.renewAt).toBe(ISSUED_AT + 5)
  })

  it('reuses the signed headers of an audience', async () => {
    const key = await P256Keypair.create()
    const credential = SpaceCredential.parse(await mintCredential(key), key)

    const alice = await credential.headers('did:plc:alice')
    expect(alice).toMatchObject({
      authorization: `Atproto-Space-Credential ${credential.token}`,
      'atproto-space-audience': 'did:plc:alice',
    })
    expect(await credential.headers('did:plc:alice')).toBe(alice)
    expect(await credential.headers('did:plc:bob')).not.toBe(alice)
  })
})
