import { describe, expect, it } from 'vitest'
import { P256Keypair } from '@atproto/crypto'
import { SpaceTokenError, createSpaceCredential } from '@atproto/space'
import type { DidString } from '@atproto/syntax'
import { SpaceCredential } from './space-credential.js'

const SPACE = 'at://did:plc:authority/space/com.example.group/test'

async function mintCredential(key: P256Keypair, expiresInSec = 600) {
  const authority = await P256Keypair.create()
  return createSpaceCredential({
    iss: 'did:plc:authority',
    sub: SPACE,
    keyId: key.did() as DidString,
    keypair: authority,
    expiresInSec,
  })
}

describe('SpaceCredential', () => {
  it('rejects a credential bound to another key', async () => {
    const token = await mintCredential(await P256Keypair.create())
    const otherKey = await P256Keypair.create()
    expect(() => SpaceCredential.parse(token, otherKey)).toThrow(
      SpaceTokenError,
    )
  })

  it('renews a minute before expiry', async () => {
    const key = await P256Keypair.create()
    const credential = SpaceCredential.parse(await mintCredential(key), key)
    const now = Math.floor(Date.now() / 1e3)
    expect(credential.renewAt).toBeGreaterThanOrEqual(now + 600 - 60)
    expect(credential.needsRenewal).toBe(false)
  })

  it('renews short-lived credentials halfway through', async () => {
    const key = await P256Keypair.create()
    const credential = SpaceCredential.parse(await mintCredential(key, 10), key)
    const now = Math.floor(Date.now() / 1e3)
    expect(credential.renewAt).toBeGreaterThanOrEqual(now + 5)
    expect(credential.renewAt).toBeLessThanOrEqual(now + 6)
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
