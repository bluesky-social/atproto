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
