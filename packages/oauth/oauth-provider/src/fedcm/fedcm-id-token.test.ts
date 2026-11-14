import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Did } from '@atproto/did'
import type { ClientId } from '../client/client-id.js'
import {
  type AccountSigner,
  FEDCM_ID_TOKEN_LIFETIME,
  FEDCM_ID_TOKEN_TYP,
  createFedcmIdToken,
} from './fedcm-id-token.js'

const did = 'did:plc:2ihkmqhirw5tturitpdyf2fa' as Did
const clientId = 'https://rp.example/oauth-client-metadata.json' as ClientId
const now = new Date('2026-11-14T12:00:00.750Z')
const authTime = new Date('2026-11-10T08:30:00.250Z')

// A real P-256 signer producing JWS (IEEE P1363) signatures, shaped like an
// @atproto/crypto Keypair.
function p256Signer(): AccountSigner & { publicKey: crypto.KeyObject } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  return {
    jwtAlg: 'ES256',
    publicKey,
    async sign(data) {
      return crypto.sign('sha256', data, {
        key: privateKey,
        dsaEncoding: 'ieee-p1363',
      })
    },
  }
}

function decode(token: string) {
  const [h, p, s] = token.split('.')
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')),
    signingInput: Buffer.from(`${h}.${p}`, 'utf8'),
    signature: Buffer.from(s, 'base64url'),
  }
}

describe('createFedcmIdToken', () => {
  it('signs a compact JWS whose header is typ atproto-id+jwt, the signer alg, and kid <did>#atproto', async () => {
    const token = await createFedcmIdToken(p256Signer(), {
      did,
      clientId,
      nonce: 'n-123',
      authTime,
      now,
    })

    expect(token.split('.')).toHaveLength(3)
    expect(decode(token).header).toEqual({
      typ: FEDCM_ID_TOKEN_TYP,
      alg: 'ES256',
      kid: `${did}#atproto`,
    })
    expect(FEDCM_ID_TOKEN_TYP).toBe('atproto-id+jwt')
  })

  it('carries exactly iss, sub, aud, nonce, iat, exp and auth_time', async () => {
    const nonce = 'nönce-✓-123'
    const token = await createFedcmIdToken(p256Signer(), {
      did,
      clientId,
      nonce,
      authTime,
      now,
    })

    const { payload } = decode(token)
    const iat = Math.floor(now.getTime() / 1000)
    expect(payload).toEqual({
      iss: did,
      sub: did,
      aud: clientId,
      nonce,
      iat,
      exp: iat + 60,
      auth_time: Math.floor(authTime.getTime() / 1000),
    })
    expect(FEDCM_ID_TOKEN_LIFETIME).toBe(60)
  })

  it('produces a signature that verifies over the signing input', async () => {
    const signer = p256Signer()
    const token = await createFedcmIdToken(signer, {
      did,
      clientId,
      nonce: 'n-123',
      authTime,
      now,
    })

    const { signingInput, signature } = decode(token)
    expect(
      crypto.verify(
        'sha256',
        signingInput,
        { key: signer.publicKey, dsaEncoding: 'ieee-p1363' },
        signature,
      ),
    ).toBe(true)
  })
})
