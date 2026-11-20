import { JoseKey } from '@atproto/oauth-provider/provider'
import { ReplayManager } from '@atproto/oauth-provider/verifier'
import { buildClientAttestation } from '@atproto/space'
import { ClientAttestationVerifier } from './client-attestation-verifier.js'

const CLIENT_ID = 'https://app.example.com/client-metadata.json'
const JWKS_URI = 'https://app.example.com/jwks.json'
const SPACE_HOST = 'did:plc:authority#atproto_pds'

describe(ClientAttestationVerifier, () => {
  let clientKey: JoseKey
  let otherKey: JoseKey

  beforeAll(async () => {
    clientKey = await JoseKey.generate(['ES256'], 'key-1')
    otherKey = await JoseKey.generate(['ES256'], 'key-1')
  })

  const metadata = (keys: { jwks?: unknown; jwks_uri?: string } = {}) => ({
    client_id: CLIENT_ID,
    client_name: 'Example App',
    redirect_uris: ['https://app.example.com/cb'],
    response_types: ['code'],
    grant_types: ['authorization_code'],
    scope: 'atproto',
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    dpop_bound_access_tokens: true,
    ...keys,
  })

  /** A verifier whose fetch serves `routes` by URL, with its own replay store. */
  const verifierFor = (routes: Record<string, unknown>) => {
    const fetch = async (input: Request) => {
      const body = routes[input.url]
      return body
        ? Response.json(body)
        : new Response('not found', { status: 404 })
    }
    const seen = new Set<string>()
    const replayManager = new ReplayManager({
      unique: (namespace, nonce) => {
        const key = `${namespace}:${nonce}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      },
    })
    return new ClientAttestationVerifier(fetch as never, replayManager)
  }

  const withJwks = () =>
    verifierFor({
      [CLIENT_ID]: metadata({ jwks: { keys: [clientKey.publicJwk] } }),
    })

  const attestation = async (
    opts: {
      signWith?: JoseKey
      aud?: string
      expiresInSec?: number
      claims?: Record<string, unknown>
    } = {},
  ) => {
    const { header, payload } = buildClientAttestation({
      clientId: CLIENT_ID,
      aud: opts.aud ?? SPACE_HOST,
      expiresInSec: opts.expiresInSec,
    })
    return (opts.signWith ?? clientKey).createJwt(
      { alg: 'ES256', ...header },
      { ...payload, ...opts.claims },
    )
  }

  const invalid = (message: string | RegExp) => ({
    error: 'InvalidClientAttestation',
    message: expect.stringMatching(message),
  })

  it('accepts an attestation signed by a key in the client jwks', async () => {
    await expect(
      withJwks().verify(await attestation(), SPACE_HOST),
    ).resolves.toBe(CLIENT_ID)
  })

  it('accepts an attestation signed by a key at the client jwks_uri', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks_uri: JWKS_URI }),
      [JWKS_URI]: { keys: [clientKey.publicJwk] },
    })
    await expect(
      verifier.verify(await attestation(), SPACE_HOST),
    ).resolves.toBe(CLIENT_ID)
  })

  it('refuses a replayed attestation', async () => {
    const verifier = withJwks()
    const replayed = await attestation()

    await expect(verifier.verify(replayed, SPACE_HOST)).resolves.toBe(CLIENT_ID)
    await expect(verifier.verify(replayed, SPACE_HOST)).rejects.toMatchObject(
      invalid('already been used'),
    )
    await expect(
      verifier.verify(await attestation(), SPACE_HOST),
    ).resolves.toBe(CLIENT_ID)
  })

  it.each([
    { note: 'no jti', claims: { jti: undefined } },
    { note: 'iss and sub disagree', claims: { sub: 'https://other.example' } },
  ])('refuses a malformed attestation: $note', async ({ claims }) => {
    await expect(
      withJwks().verify(await attestation({ claims }), SPACE_HOST),
    ).rejects.toMatchObject(invalid('Malformed client attestation'))
  })

  it('refuses an attestation signed by a key the client does not publish', async () => {
    await expect(
      withJwks().verify(await attestation({ signWith: otherKey }), SPACE_HOST),
    ).rejects.toMatchObject(invalid('Invalid client attestation'))
  })

  it('refuses an attestation addressed to another space host', async () => {
    const aud = 'did:plc:elsewhere#atproto_pds'
    await expect(
      withJwks().verify(await attestation({ aud }), SPACE_HOST),
    ).rejects.toMatchObject(invalid('Invalid client attestation'))
  })

  it('refuses an expired attestation', async () => {
    await expect(
      withJwks().verify(await attestation({ expiresInSec: -120 }), SPACE_HOST),
    ).rejects.toMatchObject(invalid('Invalid client attestation'))
  })

  it('refuses when the client publishes no keys', async () => {
    const verifier = verifierFor({ [CLIENT_ID]: metadata() })
    await expect(
      verifier.verify(await attestation(), SPACE_HOST),
    ).rejects.toMatchObject(invalid('publishes no keys'))
  })

  it('refuses when the client metadata cannot be resolved', async () => {
    await expect(
      verifierFor({}).verify(await attestation(), SPACE_HOST),
    ).rejects.toMatchObject(invalid('Could not resolve client metadata'))
  })

  it('refuses when the jwks_uri cannot be resolved', async () => {
    const verifier = verifierFor({
      [CLIENT_ID]: metadata({ jwks_uri: JWKS_URI }),
    })
    await expect(
      verifier.verify(await attestation(), SPACE_HOST),
    ).rejects.toMatchObject(invalid('Could not resolve client JWKS'))
  })
})
