import { describe, expect, it, vi } from 'vitest'
import { serviceAuth } from './service-auth.js'

describe('serviceAuth - lxm validation', () => {
  const audience = 'did:web:api.example.com'
  const issuer = 'did:web:caller.example.com'
  const nsid = 'io.example.test'

  function makeJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256K', typ: 'JWT' }),
    ).toString('base64url')
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = Buffer.from([0]).toString('base64url')
    return `${header}.${body}.${sig}`
  }

  function basePayload(overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000)
    return { iss: issuer, aud: audience, iat: now, exp: now + 60, ...overrides }
  }

  function setup() {
    const resolve = vi.fn(async () => {
      throw new Error('stop after lxm check')
    })
    const auth = serviceAuth({
      audience,
      unique: async () => true,
      didResolver: { resolve },
    })
    return { auth, resolve }
  }

  it('rejects with BadJwtLexiconMethod when lxm does not match method.nsid', async () => {
    const { auth, resolve } = setup()
    const jwt = makeJwt(basePayload({ lxm: 'io.example.different' }))
    const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
      headers: { authorization: `Bearer ${jwt}` },
    })

    await expect(
      auth({ request, method: { nsid } as any, params: {} }),
    ).rejects.toThrow('Invalid JWT lexicon method ("lxm")')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('passes lxm check when payload.lxm matches method.nsid', async () => {
    const { auth, resolve } = setup()
    const jwt = makeJwt(basePayload({ lxm: nsid }))
    const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
      headers: { authorization: `Bearer ${jwt}` },
    })

    await expect(
      auth({ request, method: { nsid } as any, params: {} }),
    ).rejects.toThrow()
    // The DID resolver isn't called unless "lxm" validation succeeded
    expect(resolve).toHaveBeenCalled()
  })

  it('skips lxm check when payload has no lxm claim', async () => {
    const { auth, resolve } = setup()
    const jwt = makeJwt(basePayload())
    const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
      headers: { authorization: `Bearer ${jwt}` },
    })

    await expect(
      auth({ request, method: { nsid } as any, params: {} }),
    ).rejects.toThrow()
    expect(resolve).toHaveBeenCalled()
  })

  it('rejects an empty-string lxm claim against a real NSID', async () => {
    const { auth, resolve } = setup()
    const jwt = makeJwt(basePayload({ lxm: '' }))
    const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
      headers: { authorization: `Bearer ${jwt}` },
    })

    await expect(
      auth({ request, method: { nsid } as any, params: {} }),
    ).rejects.toThrow('Invalid JWT lexicon method ("lxm")')
    expect(resolve).not.toHaveBeenCalled()
  })
})

describe('serviceAuth - Phase 1 service auth updates', () => {
  const audience = 'did:web:api.example.com'
  const issuer = 'did:web:caller.example.com'
  const nsid = 'io.example.test'

  function makeJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256K', typ: 'JWT' }),
    ).toString('base64url')
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = Buffer.from([0]).toString('base64url')
    return `${header}.${body}.${sig}`
  }

  function basePayload(overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000)
    return { iss: issuer, aud: audience, iat: now, exp: now + 60, ...overrides }
  }

  function setup(audienceConfig: any) {
    const resolve = vi.fn(async () => {
      throw new Error('stop after audience check')
    })
    const auth = serviceAuth({
      audience: audienceConfig,
      unique: async () => true,
      didResolver: { resolve },
    })
    return { auth, resolve }
  }

  it('accepts a combined did#serviceId aud against an audience array', async () => {
    const combinedAud = `${audience}#bsky_appview`
    const { auth, resolve } = setup([audience, combinedAud])
    const jwt = makeJwt(basePayload({ aud: combinedAud, lxm: nsid }))
    const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
      headers: { authorization: `Bearer ${jwt}` },
    })

    await expect(
      auth({ request, method: { nsid } as any, params: {} }),
    ).rejects.toThrow()
    // Proves audience check passed (throws later at DID resolution)
    expect(resolve).toHaveBeenCalled()
  })

  it('rejects an aud not in the configured audience set', async () => {
    const { auth, resolve } = setup([audience])
    const jwt = makeJwt(
      basePayload({ aud: `${audience}#bsky_appview`, lxm: nsid }),
    )
    const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
      headers: { authorization: `Bearer ${jwt}` },
    })

    await expect(
      auth({ request, method: { nsid } as any, params: {} }),
    ).rejects.toThrow('Invalid audience')
    expect(resolve).not.toHaveBeenCalled()
  })

  describe('kid-based key resolution', () => {
    // These tests require full DID document fixtures with real keypairs
    it('resolves the signing key by kid header (#atproto_label)', async () => {
      const { fixture, signJwt } = await makeFullFixture()
      const payload = {
        iss: fixture.issuer,
        aud: fixture.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        lxm: nsid,
      }
      const header = { alg: 'ES256K', typ: 'JWT', kid: '#atproto_label' }
      const jwt = await signJwt({ keypair: fixture.labelerKp, header, payload })

      const resolve = vi.fn(async () => fixture.didDocument)
      const auth = serviceAuth({
        audience: fixture.audience,
        unique: async () => true,
        didResolver: { resolve },
      })
      const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
        headers: { authorization: `Bearer ${jwt}` },
      })

      const result = await auth({ request, method: { nsid } as any, params: {} })
      expect(result.did).toBe(fixture.issuer)
      expect(resolve).toHaveBeenCalledWith(fixture.issuer, expect.anything())
    })

    it('falls back to iss fragment as kid when header.kid is absent', async () => {
      const { fixture, signJwt } = await makeFullFixture()
      const payload = {
        iss: `${fixture.issuer}#atproto_label`,
        aud: fixture.audience,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        lxm: nsid,
      }
      const header = { alg: 'ES256K', typ: 'JWT' }
      const jwt = await signJwt({ keypair: fixture.labelerKp, header, payload })

      const resolve = vi.fn(async () => fixture.didDocument)
      const auth = serviceAuth({
        audience: fixture.audience,
        unique: async () => true,
        didResolver: { resolve },
      })
      const request = new Request(`https://api.example.com/xrpc/${nsid}`, {
        headers: { authorization: `Bearer ${jwt}` },
      })

      const result = await auth({ request, method: { nsid } as any, params: {} })
      expect(result.did).toBe(fixture.issuer)
      expect(resolve).toHaveBeenCalledWith(fixture.issuer, expect.anything())
    })
  })
})

async function makeFullFixture() {
  const { Secp256k1Keypair, formatMultikey } = await import('@atproto/crypto')
  const { AtprotoDidDocument } = await import('@atproto/did')

  const issuer = 'did:web:caller.example.com'
  const audience = 'did:web:api.example.com'
  const atprotoKp = await Secp256k1Keypair.create({ exportable: true })
  const labelerKp = await Secp256k1Keypair.create({ exportable: true })

  const didDocument: AtprotoDidDocument = {
    id: issuer,
    alsoKnownAs: [],
    verificationMethod: [
      {
        id: `${issuer}#atproto`,
        type: 'Multikey',
        controller: issuer,
        publicKeyMultibase: formatMultikey(
          atprotoKp.jwtAlg,
          atprotoKp.publicKeyBytes(),
        ),
      },
      {
        id: `${issuer}#atproto_label`,
        type: 'Multikey',
        controller: issuer,
        publicKeyMultibase: formatMultikey(
          labelerKp.jwtAlg,
          labelerKp.publicKeyBytes(),
        ),
      },
    ],
    service: [],
  }

  async function signJwt(opts: {
    keypair: typeof atprotoKp
    header: Record<string, unknown>
    payload: Record<string, unknown>
  }) {
    const headerB64 = Buffer.from(JSON.stringify(opts.header)).toString(
      'base64url',
    )
    const payloadB64 = Buffer.from(JSON.stringify(opts.payload)).toString(
      'base64url',
    )
    const sig = Buffer.from(
      await opts.keypair.sign(Buffer.from(`${headerB64}.${payloadB64}`, 'utf8')),
    )
    return `${headerB64}.${payloadB64}.${sig.toString('base64url')}`
  }

  return {
    fixture: { issuer, audience, atprotoKp, labelerKp, didDocument },
    signJwt,
  }
}
