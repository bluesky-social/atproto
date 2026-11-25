import { describe, expect, it, vi } from 'vitest'
import { type Keypair, P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import type { DidString, SpaceRefString } from '@atproto/syntax'
import {
  CLIENT_ATTESTATION_TYP,
  CLOCK_SKEW_SEC,
  DELEGATION_TOKEN_TYP,
  SPACE_CREDENTIAL_TYP,
  type SpaceTokenType,
  type VerifySpaceTokenOpts,
  buildClientAttestation,
  createClientAttestation,
  createDelegationToken,
  createSpaceCredential,
  parseSpaceToken,
  verifySpaceToken,
} from './credential.js'

const SPACE: SpaceRefString = 'at:space/did:example:space/app.bsky.group/test'
const USER: DidString = 'did:example:alice'
const AUTHORITY: DidString = 'did:example:space'
const SPACE_HOST = `${AUTHORITY}#atproto_pds`
const CLIENT_ID = 'https://app.example.com/client-metadata.json'

const userKey = await Secp256k1Keypair.create()
const authorityKey = await Secp256k1Keypair.create()
const clientKey = await Secp256k1Keypair.create()
const holderKeyId = (await P256Keypair.create()).did() as DidString

const now = () => Math.floor(Date.now() / 1000)
const keyOf = (key: Keypair) => () => key.did()

const mint: Record<SpaceTokenType, () => Promise<string>> = {
  delegation: () =>
    createDelegationToken({
      iss: USER,
      sub: SPACE,
      aud: SPACE_HOST,
      keypair: userKey,
    }),
  credential: () =>
    createSpaceCredential({
      iss: AUTHORITY,
      sub: SPACE,
      keyId: holderKeyId,
      keypair: authorityKey,
    }),
  clientAttestation: () =>
    createClientAttestation({
      clientId: CLIENT_ID,
      aud: SPACE_HOST,
      kid: 'key-1',
      keypair: clientKey,
    }),
}

const toB64Url = (part: object) =>
  Buffer.from(JSON.stringify(part)).toString('base64url')
const fromB64Url = (part: string) =>
  JSON.parse(Buffer.from(part, 'base64url').toString())

async function sign(header: object, payload: object, key: Keypair) {
  const input = `${toB64Url(header)}.${toB64Url(payload)}`
  const sig = await key.sign(Buffer.from(input))
  return `${input}.${Buffer.from(sig).toString('base64url')}`
}

// Re-signs `jwt` with header and payload fields replaced, or removed when
// undefined.
async function tamper(
  jwt: string,
  patch: { header?: object; payload?: object },
  key: Keypair = authorityKey,
) {
  const [header, payload] = jwt.split('.')
  return sign(
    { ...fromB64Url(header), ...patch.header },
    { ...fromB64Url(payload), ...patch.payload },
    key,
  )
}

const verifyCredential = (
  jwt: string,
  getSigningKey: VerifySpaceTokenOpts['getSigningKey'] = keyOf(authorityKey),
) => verifySpaceToken('credential', jwt, { getSigningKey })

const tokenError = (code: string, message: RegExp) => ({
  name: 'SpaceTokenError',
  code,
  message: expect.stringMatching(message),
})

describe(createDelegationToken, () => {
  it('mints a 60-second token addressed to the space host', async () => {
    const { header, payload } = await verifySpaceToken(
      'delegation',
      await mint.delegation(),
      { getSigningKey: keyOf(userKey), aud: SPACE_HOST, sub: SPACE },
    )
    expect(header).toEqual({
      alg: userKey.jwtAlg,
      typ: DELEGATION_TOKEN_TYP,
      kid: '#atproto',
    })
    expect(payload).toMatchObject({ iss: USER, sub: SPACE, aud: SPACE_HOST })
    expect(payload.exp - payload.iat).toBe(60)
    expect(payload.jti).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe(createSpaceCredential, () => {
  it('mints a 10-minute credential bound to the holder key, with no aud', async () => {
    const { header, payload } = await verifySpaceToken(
      'credential',
      await mint.credential(),
      { getSigningKey: keyOf(authorityKey), sub: SPACE },
    )
    expect(header).toEqual({
      alg: authorityKey.jwtAlg,
      typ: SPACE_CREDENTIAL_TYP,
      kid: '#atproto',
    })
    expect(payload).toMatchObject({
      iss: AUTHORITY,
      sub: SPACE,
      cnf: { kid: holderKeyId },
    })
    expect(payload).not.toHaveProperty('aud')
    expect(payload.exp - payload.iat).toBe(600)
    expect(payload.jti).toMatch(/^[0-9a-f]{32}$/)
  })

  it('allows a lifetime of up to 60 minutes', async () => {
    const jwt = await createSpaceCredential({
      iss: AUTHORITY,
      sub: SPACE,
      keyId: holderKeyId,
      keypair: authorityKey,
      expiresInSec: 3600,
    })
    const { payload } = await verifyCredential(jwt)
    expect(payload.exp - payload.iat).toBe(3600)
  })

  it.each([0, NaN, 3601])(
    'refuses a lifetime of %s seconds',
    async (expiresInSec) => {
      await expect(
        createSpaceCredential({
          iss: AUTHORITY,
          sub: SPACE,
          keyId: holderKeyId,
          keypair: authorityKey,
          expiresInSec,
        }),
      ).rejects.toMatchObject(
        tokenError('BadJwt', /invalid space credential lifetime/),
      )
    },
  )
})

describe(buildClientAttestation, () => {
  it('names the client_id as both iss and sub, and parses without a key', async () => {
    const { header, payload } = parseSpaceToken(
      'clientAttestation',
      await mint.clientAttestation(),
    )
    expect(header).toEqual({
      alg: clientKey.jwtAlg,
      typ: CLIENT_ATTESTATION_TYP,
      kid: 'key-1',
    })
    expect(payload).toMatchObject({
      iss: CLIENT_ID,
      sub: CLIENT_ID,
      aud: SPACE_HOST,
    })
  })

  it('builds a token any JWT signer can sign', async () => {
    const token = buildClientAttestation({
      clientId: CLIENT_ID,
      aud: SPACE_HOST,
    })
    expect(token.header).toEqual({ typ: CLIENT_ATTESTATION_TYP })

    const jwt = await sign(
      { alg: clientKey.jwtAlg, ...token.header },
      token.payload,
      clientKey,
    )
    const { payload } = await verifySpaceToken('clientAttestation', jwt, {
      getSigningKey: keyOf(clientKey),
      aud: SPACE_HOST,
    })
    expect(payload).toEqual(token.payload)
  })
})

describe(parseSpaceToken, () => {
  it.each<{
    note: string
    type?: SpaceTokenType
    jwt?: string
    header?: object
    payload?: object
    error: ReturnType<typeof tokenError>
  }>([
    {
      note: 'a string that is not a JWT',
      jwt: 'nope',
      error: tokenError('BadJwt', /expected 3 parts/),
    },
    {
      note: 'a header that is not base64url JSON',
      jwt: '!!!.e30.c2ln',
      error: tokenError('BadJwt', /could not parse token header/),
    },
    {
      note: 'a token of another type',
      header: { typ: DELEGATION_TOKEN_TYP },
      error: tokenError('BadJwtType', /wrong token type/),
    },
    {
      note: 'a token with no alg',
      header: { alg: undefined },
      error: tokenError('BadJwt', /missing token "alg"/),
    },
    {
      note: 'a kid other than #atproto',
      header: { kid: '#other' },
      error: tokenError('BadJwt', /wrong token "kid"/),
    },
    {
      note: 'a token with no iss',
      payload: { iss: undefined },
      error: tokenError('BadJwtIss', /missing token "iss"/),
    },
    {
      note: 'a token with no sub',
      payload: { sub: undefined },
      error: tokenError('BadJwtSub', /missing token "sub"/),
    },
    {
      note: 'a token with no exp',
      payload: { exp: undefined },
      error: tokenError('BadJwt', /missing token "exp"/),
    },
    {
      note: 'a token with no jti',
      payload: { jti: undefined },
      error: tokenError('BadJwt', /requires a "jti"/),
    },
    {
      note: 'a delegation token with no aud',
      type: 'delegation',
      payload: { aud: undefined },
      error: tokenError('BadJwtAudience', /missing token "aud"/),
    },
    {
      note: 'a client attestation with no aud',
      type: 'clientAttestation',
      payload: { aud: undefined },
      error: tokenError('BadJwtAudience', /missing token "aud"/),
    },
    {
      note: 'a credential with no cnf',
      payload: { cnf: undefined },
      error: tokenError('BadJwtCnf', /missing token "cnf.kid"/),
    },
    {
      note: 'a credential whose cnf.kid is not a DID',
      payload: { cnf: { kid: 'key-1' } },
      error: tokenError('BadJwtCnf', /missing token "cnf.kid"/),
    },
    {
      note: 'a credential with no iat',
      payload: { iat: undefined },
      error: tokenError('BadJwt', /invalid space credential lifetime/),
    },
    {
      note: 'a credential lasting over 60 minutes',
      payload: { iat: now(), exp: now() + 3601 },
      error: tokenError('BadJwt', /invalid space credential lifetime/),
    },
    {
      note: 'a client attestation whose sub is not its iss',
      type: 'clientAttestation',
      payload: { sub: 'https://other.example/client-metadata.json' },
      error: tokenError('BadJwtIss', /must both be the client_id/),
    },
  ])('rejects $note', async ({ type = 'credential', jwt, error, ...patch }) => {
    const token = jwt ?? (await tamper(await mint[type](), patch))
    expect(() => parseSpaceToken(type, token)).toThrow(
      expect.objectContaining(error),
    )
  })
})

describe(verifySpaceToken, () => {
  it('rejects a token addressed to another audience', async () => {
    await expect(
      verifySpaceToken('delegation', await mint.delegation(), {
        getSigningKey: keyOf(userKey),
        aud: 'did:example:other#atproto_pds',
      }),
    ).rejects.toMatchObject(
      tokenError('BadJwtAudience', /does not match this service/),
    )
  })

  it('rejects a token for another subject', async () => {
    await expect(
      verifySpaceToken('delegation', await mint.delegation(), {
        getSigningKey: keyOf(userKey),
        sub: 'at:space/did:example:space/app.bsky.group/other',
      }),
    ).rejects.toMatchObject(
      tokenError('BadJwtSub', /does not match the requested space/),
    )
  })

  it('rejects a credential issued beyond the clock skew', async () => {
    const jwt = await tamper(await mint.credential(), {
      payload: { iat: now() + 60, exp: now() + 660 },
    })
    await expect(verifyCredential(jwt)).rejects.toMatchObject(
      tokenError('BadJwt', /issued in the future/),
    )
  })

  it('rejects a token expired by the clock skew', async () => {
    const jwt = await tamper(await mint.credential(), {
      payload: { iat: now() - 600, exp: now() - CLOCK_SKEW_SEC },
    })
    await expect(verifyCredential(jwt)).rejects.toMatchObject(
      tokenError('JwtExpired', /token expired/),
    )
  })

  it('accepts a token expired by less than the clock skew', async () => {
    const exp = now() - 2
    const jwt = await tamper(await mint.credential(), {
      payload: { iat: exp - 600, exp },
    })
    await expect(verifyCredential(jwt)).resolves.toMatchObject({
      payload: { iss: AUTHORITY, exp },
    })
  })

  it('retries once with a freshly resolved key after rotation', async () => {
    const rotatedKey = await Secp256k1Keypair.create()
    const jwt = await tamper(await mint.credential(), {}, rotatedKey)
    const getSigningKey = vi
      .fn()
      .mockResolvedValueOnce(authorityKey.did())
      .mockResolvedValueOnce(rotatedKey.did())

    await expect(verifyCredential(jwt, getSigningKey)).resolves.toMatchObject({
      payload: { iss: AUTHORITY },
    })
    expect(getSigningKey.mock.calls).toEqual([
      [AUTHORITY, false],
      [AUTHORITY, true],
    ])
  })

  it('rejects a bad signature after refreshing the key', async () => {
    const otherKey = await Secp256k1Keypair.create()
    const jwt = await tamper(await mint.credential(), {}, otherKey)
    const getSigningKey = vi.fn(keyOf(authorityKey))

    await expect(verifyCredential(jwt, getSigningKey)).rejects.toMatchObject(
      tokenError('BadJwtSignature', /invalid token signature/),
    )
    expect(getSigningKey.mock.calls).toEqual([
      [AUTHORITY, false],
      [AUTHORITY, true],
    ])
  })

  it('rejects a header alg that does not match the key type', async () => {
    const jwt = await tamper(await mint.credential(), {
      header: { alg: 'ES256' },
    })
    await expect(verifyCredential(jwt)).rejects.toMatchObject(
      tokenError('BadJwtSignature', /could not verify token signature/),
    )
  })
})
