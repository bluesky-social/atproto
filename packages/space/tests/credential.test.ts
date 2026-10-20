import { beforeAll, describe, expect, it, vi } from 'vitest'
import { type Keypair, P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/syntax'
import {
  SPACE_TOKEN_TYPES,
  SpaceTokenError,
  createSpaceToken,
  parseSpaceToken,
  verifySpaceToken,
} from '../src/index.js'

const SPACE = 'at://did:example:space/space/app.bsky.group/test'
const USER = 'did:example:alice'
const AUTHORITY = 'did:example:space'
const SPACE_HOST = `${AUTHORITY}#atproto_pds`
const CLIENT_ID = 'https://app.example.com/client-metadata.json'
const KEY_ID = (await P256Keypair.create()).did() as DidString

/** Overwrite fields in a token's header, leaving its payload and signature alone. */
const withHeader = (jwt: string, fields: Record<string, unknown>): string => {
  const [headerB64, payloadB64, sigB64] = jwt.split('.')
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
  const modified = Buffer.from(
    JSON.stringify({ ...header, ...fields }),
  ).toString('base64url')
  return `${modified}.${payloadB64}.${sigB64}`
}

async function withClaims(
  jwt: string,
  claims: Record<string, unknown>,
  keypair: Keypair,
): Promise<string> {
  const [header, payload] = jwt.split('.')
  const modified = {
    ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
    ...claims,
  }
  const input = `${header}.${Buffer.from(JSON.stringify(modified)).toString('base64url')}`
  const sig = await keypair.sign(Buffer.from(input))
  return `${input}.${Buffer.from(sig).toString('base64url')}`
}

describe('space tokens', () => {
  let userKey: Keypair
  let authorityKey: Keypair
  let clientKey: Keypair

  beforeAll(async () => {
    ;[userKey, authorityKey, clientKey] = await Promise.all([
      Secp256k1Keypair.create(),
      Secp256k1Keypair.create(),
      Secp256k1Keypair.create(),
    ])
  })

  const getKey = (keypair: Keypair) => () => keypair.did()

  describe('delegation token', () => {
    const create = () =>
      createSpaceToken(
        'delegation',
        { iss: USER, sub: SPACE, aud: SPACE_HOST },
        userKey,
      )

    it('round-trips', async () => {
      const { header, payload } = await verifySpaceToken(
        'delegation',
        await create(),
        { getSigningKey: getKey(userKey), aud: SPACE_HOST, sub: SPACE },
      )
      expect(header.typ).toBe('atproto-space-delegation+jwt')
      expect(header.kid).toBe('#atproto')
      expect(header.alg).toBe(userKey.jwtAlg)
      expect(payload.iss).toBe(USER)
      expect(payload.sub).toBe(SPACE)
      expect(payload.aud).toBe(SPACE_HOST)
      expect(payload.exp - payload.iat).toBe(60)
      expect(payload.jti).toMatch(/^[0-9a-f]{32}$/)
    })

    it('requires an aud at mint time', async () => {
      await expect(
        createSpaceToken('delegation', { iss: USER, sub: SPACE }, userKey),
      ).rejects.toThrow(/requires an "aud"/)
    })

    it('is rejected by an authority it was not addressed to', async () => {
      const jwt = await create()
      await expect(
        verifySpaceToken('delegation', jwt, {
          getSigningKey: getKey(userKey),
          aud: 'did:example:other#atproto_pds',
        }),
      ).rejects.toMatchObject({ code: 'BadJwtAudience' })
    })

    it('is rejected for a space other than its subject', async () => {
      const jwt = await create()
      await expect(
        verifySpaceToken('delegation', jwt, {
          getSigningKey: getKey(userKey),
          aud: SPACE_HOST,
          sub: 'at://did:example:space/space/app.bsky.group/other',
        }),
      ).rejects.toMatchObject({ code: 'BadJwtSub' })
    })

    it('is rejected when signed by the wrong key', async () => {
      const jwt = await create()
      await expect(
        verifySpaceToken('delegation', jwt, {
          getSigningKey: getKey(authorityKey),
          aud: SPACE_HOST,
        }),
      ).rejects.toMatchObject({ code: 'BadJwtSignature' })
    })

    it('is rejected when its type is wrong', async () => {
      const jwt = await create()
      await expect(
        verifySpaceToken('credential', jwt, {
          getSigningKey: getKey(userKey),
        }),
      ).rejects.toMatchObject({ code: 'BadJwtType' })
    })

    it('is rejected when its kid is not #atproto', async () => {
      const jwt = withHeader(await create(), { kid: '#other_key' })
      expect(() => parseSpaceToken('delegation', jwt)).toThrow(
        /wrong token "kid"/,
      )
    })
  })

  describe('space credential', () => {
    const create = (opts?: { expiresInSec?: number }) =>
      createSpaceToken(
        'credential',
        { iss: AUTHORITY, sub: SPACE, keyId: KEY_ID, ...opts },
        authorityKey,
      )

    it('round-trips, defaults to 10 minutes, and carries no aud', async () => {
      const { header, payload } = await verifySpaceToken(
        'credential',
        await create(),
        { getSigningKey: getKey(authorityKey), sub: SPACE },
      )
      expect(header.typ).toBe('atproto-space-credential+jwt')
      expect(header.kid).toBe('#atproto')
      expect(payload.iss).toBe(AUTHORITY)
      expect(payload.aud).toBeUndefined()
      expect(payload.exp - payload.iat).toBe(600)
      expect(payload.jti).toMatch(/^[0-9a-f]{32}$/)
    })

    it('allows a lifetime of 60 minutes', async () => {
      const jwt = await create({ expiresInSec: 3600 })
      const { payload } = await verifySpaceToken('credential', jwt, {
        getSigningKey: getKey(authorityKey),
      })
      expect(payload.exp - payload.iat).toBe(3600)
    })

    it.each([0, -1, NaN, Infinity, -Infinity, 3601])(
      'refuses to mint a credential with lifetime %s',
      async (expiresInSec) => {
        await expect(create({ expiresInSec })).rejects.toThrow(
          /invalid space credential lifetime/,
        )
      },
    )

    it.each([
      ['missing iat', { iat: undefined }],
      ['invalid iat', { iat: 'now' }],
      ['missing jti', { jti: undefined }],
      ['empty jti', { jti: '' }],
      ['non-string jti', { jti: 123 }],
    ])('rejects a credential with %s', async (_name, claims) => {
      const jwt = await withClaims(await create(), claims, authorityKey)
      await expect(
        verifySpaceToken('credential', jwt, {
          getSigningKey: getKey(authorityKey),
        }),
      ).rejects.toMatchObject({ code: 'BadJwt' })
    })

    it('rejects a signed credential lasting more than 60 minutes', async () => {
      const token = await create()
      const { payload } = parseSpaceToken('credential', token)
      const jwt = await withClaims(
        token,
        { exp: payload.iat + 3601 },
        authorityKey,
      )
      await expect(
        verifySpaceToken('credential', jwt, {
          getSigningKey: getKey(authorityKey),
        }),
      ).rejects.toMatchObject({ code: 'BadJwt' })
    })

    it('rejects future issuance beyond clock skew', async () => {
      const iat = Math.floor(Date.now() / 1000) + 60
      const jwt = await withClaims(
        await create(),
        { iat, exp: iat + 600 },
        authorityKey,
      )
      await expect(
        verifySpaceToken('credential', jwt, {
          getSigningKey: getKey(authorityKey),
        }),
      ).rejects.toMatchObject({ code: 'BadJwt' })
    })

    it('is bound to the requested signing key', async () => {
      const { payload } = await verifySpaceToken('credential', await create(), {
        getSigningKey: getKey(authorityKey),
      })
      expect(payload.cnf?.kid).toBe(KEY_ID)
    })

    it('requires a keyId at mint time', async () => {
      await expect(
        createSpaceToken(
          'credential',
          { iss: AUTHORITY, sub: SPACE },
          authorityKey,
        ),
      ).rejects.toThrow(/requires a "keyId"/)
    })

    it('is rejected when it carries no binding', async () => {
      const unbound = await createSpaceToken(
        'delegation',
        { iss: AUTHORITY, sub: SPACE, aud: SPACE_HOST },
        authorityKey,
      )
      const forgedTyp = withHeader(unbound, {
        typ: SPACE_TOKEN_TYPES.credential.typ,
      })
      expect(() => parseSpaceToken('credential', forgedTyp)).toThrow(
        /missing token "cnf.kid"/,
      )
    })

    it('cannot be minted with a kid other than #atproto', async () => {
      await expect(
        createSpaceToken(
          'credential',
          { iss: AUTHORITY, sub: SPACE, keyId: KEY_ID, kid: '#other_key' },
          authorityKey,
        ),
      ).rejects.toThrow(/"kid" is always "#atproto"/)
    })

    it('is rejected when its kid is not #atproto', async () => {
      const jwt = withHeader(await create(), { kid: '#other_key' })
      expect(() => parseSpaceToken('credential', jwt)).toThrow(
        /wrong token "kid"/,
      )
    })

    it('passes iss to the key resolver', async () => {
      const getSigningKey = vi.fn(() => authorityKey.did())
      await verifySpaceToken('credential', await create(), { getSigningKey })
      expect(getSigningKey).toHaveBeenCalledWith(AUTHORITY, false)
    })

    it('retries with a freshly resolved key when the signing key has rotated', async () => {
      const rotatedKey = await Secp256k1Keypair.create()
      const jwt = await createSpaceToken(
        'credential',
        { iss: AUTHORITY, sub: SPACE, keyId: KEY_ID },
        rotatedKey,
      )
      // First resolution returns the stale key, the retry the rotated one.
      const getSigningKey = vi
        .fn()
        .mockResolvedValueOnce(authorityKey.did())
        .mockResolvedValueOnce(rotatedKey.did())

      const { payload } = await verifySpaceToken('credential', jwt, {
        getSigningKey,
      })
      expect(payload.iss).toBe(AUTHORITY)
      expect(getSigningKey).toHaveBeenNthCalledWith(1, AUTHORITY, false)
      expect(getSigningKey).toHaveBeenNthCalledWith(2, AUTHORITY, true)
    })

    it('does not retry when the resolved key is unchanged', async () => {
      const otherKey = await Secp256k1Keypair.create()
      const jwt = await createSpaceToken(
        'credential',
        { iss: AUTHORITY, sub: SPACE, keyId: KEY_ID },
        otherKey,
      )
      const getSigningKey = vi.fn(() => authorityKey.did())
      await expect(
        verifySpaceToken('credential', jwt, { getSigningKey }),
      ).rejects.toMatchObject({ code: 'BadJwtSignature' })
      expect(getSigningKey).toHaveBeenCalledTimes(2)
    })

    it('rejects an expired credential', async () => {
      const jwt = await create({ expiresInSec: 1 })
      vi.useFakeTimers()
      try {
        vi.setSystemTime(Date.now() + 60_000)
        await expect(
          verifySpaceToken('credential', jwt, {
            getSigningKey: getKey(authorityKey),
          }),
        ).rejects.toMatchObject({ code: 'JwtExpired' })
      } finally {
        vi.useRealTimers()
      }
    })

    it('tolerates small clock skew', async () => {
      const jwt = await create({ expiresInSec: 1 })
      vi.useFakeTimers()
      try {
        // 2s past exp — inside the 5s skew allowance.
        vi.setSystemTime(Date.now() + 3_000)
        await expect(
          verifySpaceToken('credential', jwt, {
            getSigningKey: getKey(authorityKey),
          }),
        ).resolves.toBeTruthy()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('client attestation', () => {
    const create = () =>
      createSpaceToken(
        'clientAttestation',
        { iss: CLIENT_ID, sub: CLIENT_ID, aud: SPACE_HOST, kid: 'key-1' },
        clientKey,
      )

    it('parses without needing a key', async () => {
      const { header, payload } = parseSpaceToken(
        'clientAttestation',
        await create(),
      )
      expect(header.typ).toBe('atproto-client-attestation+jwt')
      expect(header.kid).toBe('key-1')
      expect(payload.iss).toBe(CLIENT_ID)
      expect(payload.sub).toBe(CLIENT_ID)
      expect(payload.aud).toBe(SPACE_HOST)
    })

    it('requires iss and sub to both be the client_id', async () => {
      const jwt = await createSpaceToken(
        'clientAttestation',
        { iss: CLIENT_ID, sub: 'https://other.example/x', aud: SPACE_HOST },
        clientKey,
      )
      expect(() => parseSpaceToken('clientAttestation', jwt)).toThrow(
        /must both be the client_id/,
      )
    })

    it('verifies against the client key when one is resolvable', async () => {
      const { payload } = await verifySpaceToken(
        'clientAttestation',
        await create(),
        { getSigningKey: getKey(clientKey), aud: SPACE_HOST },
      )
      expect(payload.iss).toBe(CLIENT_ID)
    })
  })

  describe('malformed tokens', () => {
    it.each([
      ['not a jwt', 'nope'],
      ['too few parts', 'aaa.bbb'],
      ['bad base64 header', '!!!.e30.c2ln'],
    ])('rejects %s', (_name, jwt) => {
      expect(() => parseSpaceToken('credential', jwt)).toThrow(SpaceTokenError)
    })

    it('rejects a token missing required claims', async () => {
      const header = Buffer.from(
        JSON.stringify({
          alg: 'ES256K',
          typ: SPACE_TOKEN_TYPES.credential.typ,
          kid: SPACE_TOKEN_TYPES.credential.kid,
        }),
      ).toString('base64url')
      const payload = Buffer.from(JSON.stringify({ iss: AUTHORITY })).toString(
        'base64url',
      )
      expect(() =>
        parseSpaceToken('credential', `${header}.${payload}.c2ln`),
      ).toThrow(/missing token "sub"/)
    })
  })
})
