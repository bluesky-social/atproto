import { JoseKey } from '@atproto/oauth-provider'
import { ClientAttestationVerifier } from '../src/client-attestation-verifier.js'

const CLIENT_ID = 'https://app.example.com/client-metadata.json'
const JWKS_URI = 'https://app.example.com/jwks.json'
const SPACE_HOST = 'did:plc:authority#atproto_space_host'

describe('client attestation verification', () => {
  let clientKey: JoseKey
  let otherKey: JoseKey

  beforeAll(async () => {
    clientKey = await JoseKey.generate(['ES256'], 'key-1')
    otherKey = await JoseKey.generate(['ES256'], 'key-1')
  })

  const metadata = (extra?: Record<string, unknown>) => ({
    client_id: CLIENT_ID,
    client_name: 'Example App',
    redirect_uris: ['https://app.example.com/cb'],
    response_types: ['code'],
    grant_types: ['authorization_code'],
    scope: 'atproto',
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    dpop_bound_access_tokens: true,
    ...extra,
  })

  // Serves the client's metadata (and JWKS, when hosted separately) so the
  // verifier resolves against a known key without touching the network.
  const verifierFor = (
    routes: Record<string, unknown>,
  ): ClientAttestationVerifier => {
    const fetch = async (input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url
      const body = routes[url]
      if (!body) return new Response('not found', { status: 404 })
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new ClientAttestationVerifier(fetch as never)
  }

  const attestation = async (
    key: JoseKey,
    opts?: { iss?: string; sub?: string; aud?: string; expiresInSec?: number },
  ) => {
    const now = Math.floor(Date.now() / 1000)
    return key.createJwt(
      { alg: 'ES256', typ: 'atproto-client-attestation+jwt' },
      {
        iss: opts?.iss ?? CLIENT_ID,
        sub: opts?.sub ?? CLIENT_ID,
        aud: opts?.aud ?? SPACE_HOST,
        iat: now,
        exp: now + (opts?.expiresInSec ?? 60),
        jti: 'nonce-1',
      },
    )
  }

  it('accepts an attestation signed by a key in the client jwks', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks: { keys: [clientKey.publicJwk] } }),
    })
    const clientId = await verifier.verify(
      await attestation(clientKey),
      SPACE_HOST,
    )
    expect(clientId).toBe(CLIENT_ID)
  })

  it('accepts an attestation when the client publishes a jwks_uri', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks_uri: JWKS_URI }),
      [JWKS_URI]: { keys: [clientKey.publicJwk] },
    })
    const clientId = await verifier.verify(
      await attestation(clientKey),
      SPACE_HOST,
    )
    expect(clientId).toBe(CLIENT_ID)
  })

  it('refuses an attestation signed by a key the client does not publish', async () => {
    // The forgery this whole check exists to stop: anyone can claim a
    // client_id, only the real client can sign for it.
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks: { keys: [clientKey.publicJwk] } }),
    })
    await expect(
      verifier.verify(await attestation(otherKey), SPACE_HOST),
    ).rejects.toThrow(/Invalid client attestation/)
  })

  it('refuses an attestation addressed to another space host', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks: { keys: [clientKey.publicJwk] } }),
    })
    await expect(
      verifier.verify(
        await attestation(clientKey, {
          aud: 'did:plc:elsewhere#atproto_space_host',
        }),
        SPACE_HOST,
      ),
    ).rejects.toThrow(/Invalid client attestation/)
  })

  it('refuses an expired attestation', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks: { keys: [clientKey.publicJwk] } }),
    })
    await expect(
      verifier.verify(
        await attestation(clientKey, { expiresInSec: -120 }),
        SPACE_HOST,
      ),
    ).rejects.toThrow(/Invalid client attestation/)
  })

  it('refuses an attestation whose iss and sub disagree', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks: { keys: [clientKey.publicJwk] } }),
    })
    await expect(
      verifier.verify(
        await attestation(clientKey, { sub: 'https://other.example/x' }),
        SPACE_HOST,
      ),
    ).rejects.toThrow()
  })

  it('refuses when the client publishes no keys', async () => {
    const verifier = verifierFor({ [CLIENT_ID]: metadata() })
    await expect(
      verifier.verify(await attestation(clientKey), SPACE_HOST),
    ).rejects.toThrow(/publishes no keys/)
  })

  it('refuses when the client metadata cannot be resolved', async () => {
    const verifier = verifierFor({})
    await expect(
      verifier.verify(await attestation(clientKey), SPACE_HOST),
    ).rejects.toThrow(/Could not resolve client metadata/)
  })

  it('refuses when the jwks_uri cannot be resolved', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks_uri: JWKS_URI }),
    })
    await expect(
      verifier.verify(await attestation(clientKey), SPACE_HOST),
    ).rejects.toThrow(/Could not resolve client JWKS/)
  })
})
