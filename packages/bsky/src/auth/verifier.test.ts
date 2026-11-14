import { randomBytes } from 'node:crypto'
import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import type { DataPlaneClient } from '../data-plane/index.js'
import { AuthVerifier } from './verifier.js'

const serviceDid = 'did:web:bsky.localhost'
const userDid = 'did:plc:abcdefghijklmnopqrstuvwx'
const method = 'app.bsky.feed.getTimeline'

function createVerifier(
  bsgJwtSecret: Uint8Array | undefined,
  internalServiceSecrets?: Record<string, Uint8Array>,
) {
  return new AuthVerifier({} as DataPlaneClient, {
    ownDid: serviceDid,
    alternateAudienceDids: [],
    modServiceDid: 'did:example:moderation',
    adminPasses: ['admin-pass'],
    bsgJwtSecret,
    internalServiceSecrets,
  })
}

type TokenOpts = {
  secret: Uint8Array
  alg?: string
  typ?: string
  claims?: Record<string, unknown>
  expiresIn?: string | number | null
}

async function createToken({
  secret,
  alg = 'HS256',
  typ = 'bsg+jwt',
  claims = {},
  expiresIn = '1m',
}: TokenOpts) {
  const jwt = new SignJWT({
    iss: 'bsg',
    aud: 'bsky',
    lxm: method,
    scopes: ['read'],
    ...claims,
  }).setProtectedHeader({ alg, typ })
  if (expiresIn !== null) jwt.setExpirationTime(expiresIn)
  return jwt.sign(secret)
}

function reqCtx(token: string, nsid = method) {
  return {
    req: {
      url: `/xrpc/${nsid}`,
      originalUrl: `/xrpc/${nsid}`,
      headers: { authorization: `Bearer ${token}` },
    },
  } as never
}

describe('BSG token', () => {
  const secret = randomBytes(32)
  const verifier = createVerifier(secret)

  it('treats a token without sub as anonymous', async () => {
    const token = await createToken({ secret })
    await expect(
      verifier.standardReadOptional()(reqCtx(token)),
    ).resolves.toEqual({ credentials: { type: 'none', iss: null } })
    await expect(verifier.standardRead()(reqCtx(token))).rejects.toThrow()
    await expect(
      verifier.standardReadOrRoleOptional(reqCtx(token)),
    ).resolves.toEqual({ credentials: { type: 'none', iss: null } })
  })

  it('uses sub as the viewer', async () => {
    const token = await createToken({ secret, claims: { sub: userDid } })
    await expect(verifier.standardRead()(reqCtx(token))).resolves.toEqual({
      credentials: { type: 'standard', aud: serviceDid, iss: userDid },
    })
  })

  it('requires the scope in the name of the verifier', async () => {
    const read = await createToken({
      secret,
      claims: { sub: userDid, scopes: ['read'] },
    })
    const write = await createToken({
      secret,
      claims: { sub: userDid, scopes: ['read', 'write:service'] },
    })
    const writeOnly = await createToken({
      secret,
      claims: { sub: userDid, scopes: ['write:service'] },
    })
    await expect(verifier.standardWriteService()(reqCtx(read))).rejects.toThrow(
      'token lacks required scope',
    )
    await expect(
      verifier.standardWriteService()(reqCtx(write)),
    ).resolves.toMatchObject({ credentials: { iss: userDid } })
    await expect(verifier.standardRead()(reqCtx(writeOnly))).rejects.toThrow(
      'token lacks required scope',
    )
    await expect(
      verifier.standardReadOptional()(reqCtx(writeOnly)),
    ).rejects.toThrow('token lacks required scope')
  })

  it('rejects a token without scopes', async () => {
    const token = await createToken({
      secret,
      claims: { sub: userDid, scopes: undefined },
    })
    await expect(verifier.standardRead()(reqCtx(token))).rejects.toThrow()
  })

  it('rejects a token for another method', async () => {
    const token = await createToken({ secret })
    await expect(
      verifier.standardReadOptional()(
        reqCtx(token, 'app.bsky.actor.getProfile'),
      ),
    ).rejects.toThrow('bad jwt lexicon method')
  })

  it('rejects invalid tokens', async () => {
    const tokens = [
      await createToken({ secret: randomBytes(32) }),
      await createToken({ secret, alg: 'HS384' }),
      await createToken({ secret, expiresIn: null }),
      await createToken({ secret, expiresIn: -1 }),
      await createToken({ secret, claims: { iss: 'other' } }),
      await createToken({ secret, claims: { aud: 'chat' } }),
      await createToken({ secret, claims: { lxm: undefined } }),
      await createToken({ secret, claims: { sub: 'not-a-did' } }),
    ]
    for (const token of tokens) {
      await expect(
        verifier.standardReadOptional()(reqCtx(token)),
      ).rejects.toThrow()
    }
  })

  it('rejects BSG tokens when no secret is configured', async () => {
    const token = await createToken({ secret })
    await expect(
      createVerifier(undefined).standardReadOptional()(reqCtx(token)),
    ).rejects.toThrow()
  })
})

describe('internal service token', () => {
  const chatSecret = randomBytes(32)
  const otherSecret = randomBytes(32)
  const verifier = createVerifier(undefined, {
    chat: chatSecret,
    other: otherSecret,
  })
  const claims = { iss: 'chat', scopes: undefined }

  it('accepts a token signed with the secret of its issuer', async () => {
    const token = await createToken({
      secret: chatSecret,
      typ: 'internal+jwt',
      claims: { ...claims, sub: userDid },
    })
    await expect(verifier.internal(reqCtx(token))).resolves.toEqual({
      credentials: { type: 'internal', iss: 'chat', sub: userDid },
    })
  })

  it('accepts a token without sub', async () => {
    const token = await createToken({
      secret: chatSecret,
      typ: 'internal+jwt',
      claims,
    })
    await expect(verifier.internal(reqCtx(token))).resolves.toEqual({
      credentials: { type: 'internal', iss: 'chat', sub: null },
    })
  })

  it('gives the same access as the admin password', async () => {
    const token = await createToken({
      secret: chatSecret,
      typ: 'internal+jwt',
      claims: { ...claims, sub: userDid },
    })
    const creds = await verifier.internal(reqCtx(token))
    expect(verifier.parseCreds(creds)).toMatchObject({
      viewer: userDid,
      includeTakedowns: true,
      include3pBlocks: true,
      canPerformTakedown: true,
    })
    expect(
      verifier.parseCreds({
        credentials: { type: 'role' },
      }),
    ).toMatchObject({ viewer: null, includeTakedowns: true })
  })

  it('rejects invalid tokens', async () => {
    const tokens = [
      // signed with another service's secret
      await createToken({
        secret: otherSecret,
        typ: 'internal+jwt',
        claims,
      }),
      // unknown service
      await createToken({
        secret: chatSecret,
        typ: 'internal+jwt',
        claims: { ...claims, iss: 'unknown' },
      }),
      // wrong type
      await createToken({ secret: chatSecret, claims }),
      await createToken({
        secret: chatSecret,
        typ: 'internal+jwt',
        claims: { ...claims, aud: 'chat' },
      }),
      await createToken({
        secret: chatSecret,
        typ: 'internal+jwt',
        claims: { ...claims, lxm: 'app.bsky.actor.getProfile' },
      }),
      await createToken({
        secret: chatSecret,
        typ: 'internal+jwt',
        claims: { ...claims, sub: 'not-a-did' },
      }),
      await createToken({
        secret: chatSecret,
        typ: 'internal+jwt',
        claims,
        expiresIn: -1,
      }),
    ]
    for (const token of tokens) {
      await expect(verifier.internal(reqCtx(token))).rejects.toThrow()
    }
  })

  it('is not accepted by the standard verifiers', async () => {
    const token = await createToken({
      secret: chatSecret,
      typ: 'internal+jwt',
      claims: { ...claims, sub: userDid },
    })
    await expect(verifier.standardRead()(reqCtx(token))).rejects.toThrow()
  })

  it('rejects the admin password', async () => {
    const req = {
      req: {
        url: `/xrpc/${method}`,
        originalUrl: `/xrpc/${method}`,
        headers: {
          authorization: `Basic ${Buffer.from('admin:admin-pass').toString('base64')}`,
        },
      },
    } as never
    await expect(verifier.internal(req)).rejects.toThrow()
  })
})
