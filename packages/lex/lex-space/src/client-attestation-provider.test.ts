import { describe, expect, expectTypeOf, it } from 'vitest'
import { P256Keypair } from '@atproto/crypto'
import { Keyset, type SignedJwt } from '@atproto/jwk'
import { JoseKey } from '@atproto/jwk-jose'
import type { OAuthClient } from '@atproto/oauth-client'
import { parseSpaceToken, verifySpaceToken } from '@atproto/space'
import {
  clientAttestationProviderFor,
  clientAttestationProviderForOAuthClient,
} from './client-attestation-provider.js'

const CLIENT_ID = 'https://app.example.com/client-metadata.json'
const SPACE_HOST = 'did:example:space#atproto_pds'

describe(clientAttestationProviderFor, () => {
  it('signs with an OAuth client keyset', async () => {
    const keyset = new Keyset([await JoseKey.generate(['ES256'], 'key-1')])
    const provide = clientAttestationProviderFor(CLIENT_ID, keyset)

    const jwt = await provide(SPACE_HOST)
    const { header, payload } = parseSpaceToken('clientAttestation', jwt)
    expect(header).toMatchObject({ alg: 'ES256', kid: 'key-1' })
    expect(payload).toMatchObject({
      iss: CLIENT_ID,
      sub: CLIENT_ID,
      aud: SPACE_HOST,
    })
    expect(payload.exp - payload.iat).toBe(60)

    await expect(
      keyset.verifyJwt(jwt as SignedJwt, {
        audience: SPACE_HOST,
        issuer: CLIENT_ID,
        typ: 'atproto-client-attestation+jwt',
      }),
    ).resolves.toBeDefined()
  })

  it('selects the keyset key by kid', async () => {
    const keyset = new Keyset([
      await JoseKey.generate(['ES256'], 'key-1'),
      await JoseKey.generate(['ES256'], 'key-2'),
    ])
    const provide = clientAttestationProviderFor(CLIENT_ID, keyset, {
      kid: 'key-2',
      expiresInSec: 30,
    })

    const { header, payload } = parseSpaceToken(
      'clientAttestation',
      await provide(SPACE_HOST),
    )
    expect(header.kid).toBe('key-2')
    expect(payload.exp - payload.iat).toBe(30)
  })

  it('signs with a keypair', async () => {
    const key = await P256Keypair.create()
    const provide = clientAttestationProviderFor(CLIENT_ID, key, {
      kid: 'key-1',
    })

    const { header, payload } = await verifySpaceToken(
      'clientAttestation',
      await provide(SPACE_HOST),
      { getSigningKey: () => key.did(), aud: SPACE_HOST },
    )
    expect(header).toMatchObject({ alg: key.jwtAlg, kid: 'key-1' })
    expect(payload).toMatchObject({ iss: CLIENT_ID, sub: CLIENT_ID })
  })
})

describe(clientAttestationProviderForOAuthClient, () => {
  it('accepts an OAuthClient', () => {
    expectTypeOf<OAuthClient>().toExtend<
      Parameters<typeof clientAttestationProviderForOAuthClient>[0]
    >()
  })

  it("signs with the client's keyset, as its client_id", async () => {
    const keyset = new Keyset([await JoseKey.generate(['ES256'], 'key-1')])
    const provide = clientAttestationProviderForOAuthClient({
      clientMetadata: { client_id: CLIENT_ID },
      keyset,
    })

    const jwt = await provide(SPACE_HOST)
    const { payload } = await keyset.verifyJwt(jwt as SignedJwt, {
      audience: SPACE_HOST,
      issuer: CLIENT_ID,
      typ: 'atproto-client-attestation+jwt',
    })
    expect(payload.sub).toBe(CLIENT_ID)
  })

  it('throws for a client without keys', () => {
    expect(() =>
      clientAttestationProviderForOAuthClient({
        clientMetadata: { client_id: CLIENT_ID },
      }),
    ).toThrow(TypeError)
  })
})
