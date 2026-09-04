import { beforeAll, describe, expect, it, vi } from 'vitest'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
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
const SPACE_HOST = `${AUTHORITY}#atproto_space_host`
const CLIENT_ID = 'https://app.example.com/client-metadata.json'
const DPOP_JKT = '0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I'

/** Swap a token's `typ` header, leaving its payload and signature alone. */
const retypeToken = (jwt: string, typ: string): string => {
  const [headerB64, payloadB64, sigB64] = jwt.split('.')
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
  const retyped = Buffer.from(JSON.stringify({ ...header, typ })).toString(
    'base64url',
  )
  return `${retyped}.${payloadB64}.${sigB64}`
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
          aud: 'did:example:other#atproto_space_host',
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
  })

  describe('space credential', () => {
    const create = (opts?: { expiresInSec?: number; kid?: string }) =>
      createSpaceToken(
        'credential',
        { iss: AUTHORITY, sub: SPACE, dpopJkt: DPOP_JKT, ...opts },
        authorityKey,
      )

    it('round-trips, defaults to 2h, and carries no aud', async () => {
      const { header, payload } = await verifySpaceToken(
        'credential',
        await create(),
        { getSigningKey: getKey(authorityKey), sub: SPACE },
      )
      expect(header.typ).toBe('atproto-space-credential+jwt')
      expect(header.kid).toBe('#atproto')
      expect(payload.iss).toBe(AUTHORITY)
      expect(payload.aud).toBeUndefined()
      expect(payload.exp - payload.iat).toBe(7200)
    })

    it('is bound to the requested DPoP key', async () => {
      const { payload } = await verifySpaceToken('credential', await create(), {
        getSigningKey: getKey(authorityKey),
      })
      expect(payload.cnf?.jkt).toBe(DPOP_JKT)
    })

    it('requires a dpopJkt at mint time', async () => {
      await expect(
        createSpaceToken(
          'credential',
          { iss: AUTHORITY, sub: SPACE },
          authorityKey,
        ),
      ).rejects.toThrow(/requires a "dpopJkt"/)
    })

    it('is rejected when it carries no binding', async () => {
      const unbound = await createSpaceToken(
        'delegation',
        { iss: AUTHORITY, sub: SPACE, aud: SPACE_HOST },
        authorityKey,
      )
      const forgedTyp = retypeToken(unbound, SPACE_TOKEN_TYPES.credential.typ)
      expect(() => parseSpaceToken('credential', forgedTyp)).toThrow(
        /missing token "cnf.jkt"/,
      )
    })

    it('passes iss and kid to the key resolver', async () => {
      const getSigningKey = vi.fn(() => authorityKey.did())
      await verifySpaceToken('credential', await create(), { getSigningKey })
      expect(getSigningKey).toHaveBeenCalledWith(AUTHORITY, '#atproto', false)
    })

    it('honours a kid override for authorities with a dedicated space key', async () => {
      const getSigningKey = vi.fn(() => authorityKey.did())
      const jwt = await create({ kid: '#atproto_space' })
      await verifySpaceToken('credential', jwt, { getSigningKey })
      expect(getSigningKey).toHaveBeenCalledWith(
        AUTHORITY,
        '#atproto_space',
        false,
      )
    })

    it('retries with a freshly resolved key when the signing key has rotated', async () => {
      const rotatedKey = await Secp256k1Keypair.create()
      const jwt = await createSpaceToken(
        'credential',
        { iss: AUTHORITY, sub: SPACE, dpopJkt: DPOP_JKT },
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
      expect(getSigningKey).toHaveBeenNthCalledWith(
        1,
        AUTHORITY,
        '#atproto',
        false,
      )
      expect(getSigningKey).toHaveBeenNthCalledWith(
        2,
        AUTHORITY,
        '#atproto',
        true,
      )
    })

    it('does not retry when the resolved key is unchanged', async () => {
      const otherKey = await Secp256k1Keypair.create()
      const jwt = await createSpaceToken(
        'credential',
        { iss: AUTHORITY, sub: SPACE, dpopJkt: DPOP_JKT },
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
