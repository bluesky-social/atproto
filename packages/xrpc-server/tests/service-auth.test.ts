import { Secp256k1Keypair } from '@atproto/crypto'
import { createServiceJwt, verifyJwt } from '../src'

describe('Service auth', () => {
  it('creates and validates service auth headers', async () => {
    const keypair = await Secp256k1Keypair.create()
    const iss = 'did:example:alice'
    const aud = 'did:example:bob'
    const token = await createServiceJwt({
      iss,
      aud,
      keypair,
    })
    const validated = await verifyJwt(token, null, async () => keypair.did())
    expect(validated.iss).toEqual(iss)
    expect(validated.aud).toEqual(aud)
    // should expire within the minute when no exp is provided
    expect(validated.exp).toBeGreaterThan(Date.now() / 1000)
    expect(validated.exp).toBeLessThan(Date.now() / 1000 + 60)
    expect(typeof validated.nonce).toBe('string')
    expect(validated.scope).toBeUndefined()
  })

  it('creates and validates service auth headers with scopes', async () => {
    const keypair = await Secp256k1Keypair.create()
    const iss = 'did:example:alice'
    const aud = 'did:example:bob'
    const scope = [
      'com.atproto.repo.createRecord',
      'com.atproto.repo.putRecord',
    ]
    const token = await createServiceJwt({
      iss,
      aud,
      keypair,
      scope,
    })
    const validated = await verifyJwt(token, null, async () => keypair.did())
    expect(validated.iss).toEqual(iss)
    expect(validated.aud).toEqual(aud)
    expect(validated.scope).toEqual(scope)
  })
})
