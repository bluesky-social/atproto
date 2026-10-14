import { randomBytes } from 'node:crypto'
import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { AuthVerifier } from './auth-verifier.js'
import type { DataPlaneClient } from './data-plane/index.js'

const serviceDid = 'did:web:bsky.localhost'
const userDid = 'did:plc:abcdefghijklmnopqrstuvwx'

function createVerifier(secret = Buffer.from(randomBytes(32).toString('hex'))) {
  return {
    secret,
    verifier: new AuthVerifier({} as DataPlaneClient, {
      ownDid: serviceDid,
      alternateAudienceDids: [],
      modServiceDid: 'did:example:moderation',
      adminPasses: [],
      bffJwtSecret: secret.toString('utf8'),
    }),
  }
}

async function createToken(
  secret: Uint8Array,
  sub = userDid,
  aud = serviceDid,
  expiresIn: string | number = '1m',
) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'bff+jwt' })
    .setSubject(sub)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

describe('BFF session auth', () => {
  it('rejects wrong signatures, unsupported algorithms, and missing expiry', async () => {
    const { secret, verifier } = createVerifier()
    const tokens = [
      await createToken(randomBytes(32)),
      await new SignJWT({ sub: userDid, aud: serviceDid })
        .setProtectedHeader({ alg: 'HS384', typ: 'bff+jwt' })
        .setExpirationTime('1m')
        .sign(secret),
      await new SignJWT({ sub: userDid, aud: serviceDid })
        .setProtectedHeader({ alg: 'HS256', typ: 'bff+jwt' })
        .sign(secret),
    ]

    for (const token of tokens) {
      await expect(
        verifier.standard({
          req: { headers: { authorization: `Bearer ${token}` } },
        } as never),
      ).rejects.toThrow('BFF token could not be verified')
    }
  })

  it('rejects BFF tokens when no shared secret is configured', async () => {
    const { verifier } = createVerifier(Buffer.from(''))
    const token = await createToken(randomBytes(32))

    await expect(
      verifier.standard({
        req: { headers: { authorization: `Bearer ${token}` } },
      } as never),
    ).rejects.toThrow('BFF authentication is not configured')
  })

  it('uses the token subject as the viewer for the intended service', async () => {
    const { secret, verifier } = createVerifier()
    const token = await createToken(secret)
    const result = await verifier.standardOptionalParameterized({})({
      req: {
        headers: { authorization: `Bearer ${token}` },
      },
    } as never)

    expect(result).toEqual({
      credentials: {
        type: 'standard',
        aud: serviceDid,
        iss: userDid,
      },
    })
  })

  it('rejects tokens issued for a different service', async () => {
    const { secret, verifier } = createVerifier()
    const token = await createToken(secret, userDid, 'did:web:chat.localhost')

    await expect(
      verifier.standardOptionalParameterized({})({
        req: { headers: { authorization: `Bearer ${token}` } },
      } as never),
    ).rejects.toThrow()
  })

  it('rejects expired tokens and malformed subjects', async () => {
    const { secret, verifier } = createVerifier()
    const expired = await createToken(secret, userDid, serviceDid, -1)
    const invalidSubject = await createToken(secret, 'not-a-did')

    for (const token of [expired, invalidSubject]) {
      await expect(
        verifier.standardOptionalParameterized({})({
          req: { headers: { authorization: `Bearer ${token}` } },
        } as never),
      ).rejects.toThrow()
    }
  })
})
