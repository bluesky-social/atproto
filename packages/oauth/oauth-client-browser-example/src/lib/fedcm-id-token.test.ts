import { describe, expect, it } from 'vitest'
import { Secp256k1Keypair } from '@atproto/crypto'
import type {
  AtprotoDid,
  AtprotoIdentityDidMethods,
  DidDocument,
} from '@atproto/did'
import { toBase64, utf8ToBase64 } from '@atproto/lex'
import {
  type FedcmIdentityResolver,
  verifyFedcmIdToken,
} from './fedcm-id-token.js'

const DID = 'did:plc:abcdefghijklmnopqrstuvwx' as AtprotoDid
const CLIENT_ID = 'https://app.example/client-metadata.json'
const NONCE = 'nonce-123'
const NOW = 1_700_000_000_000

const b64 = (value: unknown) => utf8ToBase64(JSON.stringify(value), 'base64url')

function makeDidDoc(
  keypair: Secp256k1Keypair,
  method: Record<string, unknown> = {},
): DidDocument<AtprotoIdentityDidMethods> {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: DID,
    verificationMethod: [
      {
        id: `${DID}#atproto`,
        type: 'Multikey',
        controller: DID,
        publicKeyMultibase: keypair.did().slice('did:key:'.length),
        ...method,
      },
    ],
  } as DidDocument<AtprotoIdentityDidMethods>
}

const validHeader = {
  typ: 'atproto-id+jwt',
  alg: 'ES256K',
  kid: `${DID}#atproto`,
}
const validPayload = {
  iss: DID,
  sub: DID,
  aud: CLIENT_ID,
  nonce: NONCE,
  iat: NOW / 1000,
  exp: NOW / 1000 + 60,
  auth_time: NOW / 1000 - 5,
}

async function sign(
  keypair: Secp256k1Keypair,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const signingInput = `${b64(header)}.${b64(payload)}`
  const sig = await keypair.sign(new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64(sig, 'base64url')}`
}

describe(verifyFedcmIdToken, () => {
  async function setup(
    overrides: {
      header?: Record<string, unknown>
      payload?: Record<string, unknown>
      handle?: string
      didDoc?: DidDocument<AtprotoIdentityDidMethods>
      signer?: Secp256k1Keypair
    } = {},
  ) {
    const keypair = await Secp256k1Keypair.create()
    const token = await sign(
      overrides.signer ?? keypair,
      { ...validHeader, ...overrides.header },
      { ...validPayload, ...overrides.payload },
    )
    const resolve: FedcmIdentityResolver = async () => ({
      didDoc: overrides.didDoc ?? makeDidDoc(keypair),
      handle: overrides.handle ?? 'alice.test',
    })
    return {
      keypair,
      token,
      resolve,
      verify: (t: unknown = token, r = resolve) =>
        verifyFedcmIdToken(t, {
          clientId: CLIENT_ID,
          nonce: NONCE,
          resolve: r,
          now: NOW,
        }),
    }
  }

  it('accepts a valid token and returns did, handle and auth_time', async () => {
    const { verify } = await setup()
    await expect(verify()).resolves.toEqual({
      did: DID,
      handle: 'alice.test',
      authTime: validPayload.auth_time,
    })
  })

  it('returns handle undefined when the handle is handle.invalid', async () => {
    const { verify } = await setup({ handle: 'handle.invalid' })
    const result = await verify()
    expect(result.handle).toBeUndefined()
    expect(result.did).toBe(DID)
  })

  it('rejects a non-string token', async () => {
    const { verify } = await setup()
    await expect(verify(42)).rejects.toThrow()
  })

  it('rejects a token without three segments', async () => {
    const { verify } = await setup()
    await expect(verify('a.b')).rejects.toThrow()
    await expect(verify('a.b.c.d')).rejects.toThrow()
  })

  it('rejects a wrong typ', async () => {
    const { verify } = await setup({ header: { typ: 'JWT' } })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects a kid that is not <sub>#atproto', async () => {
    const { verify } = await setup({
      header: { kid: 'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz#atproto' },
    })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects iss different from sub', async () => {
    const { verify } = await setup({
      payload: { iss: 'did:plc:zzzzzzzzzzzzzzzzzzzzzzzz' },
    })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects a sub that is not an atproto DID', async () => {
    const sub = 'did:example:123'
    const { verify } = await setup({
      header: { kid: `${sub}#atproto` },
      payload: { iss: sub, sub },
    })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects an aud that is not the client_id', async () => {
    const { verify } = await setup({ payload: { aud: 'https://evil.example' } })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects a nonce mismatch', async () => {
    const { verify } = await setup({ payload: { nonce: 'other' } })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const { verify } = await setup({
      payload: { exp: NOW / 1000 - 31 },
    })
    await expect(verify()).rejects.toThrow()
  })

  it('accepts a token that expired within the skew', async () => {
    const { verify } = await setup({ payload: { exp: NOW / 1000 - 10 } })
    await expect(verify()).resolves.toMatchObject({ did: DID })
  })

  it('rejects a signature by a different key', async () => {
    const other = await Secp256k1Keypair.create()
    const { verify } = await setup({ signer: other })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects a DID document without #atproto', async () => {
    const keypair = await Secp256k1Keypair.create()
    const didDoc = makeDidDoc(keypair, { id: `${DID}#other` })
    const { verify } = await setup({ didDoc })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects a non-Multikey key type', async () => {
    const keypair = await Secp256k1Keypair.create()
    const didDoc = makeDidDoc(keypair, { type: 'JsonWebKey2020' })
    const { verify } = await setup({ didDoc })
    await expect(verify()).rejects.toThrow()
  })

  it('rejects an alg that differs from the key jwtAlg', async () => {
    const { verify } = await setup({ header: { alg: 'ES256' } })
    await expect(verify()).rejects.toThrow()
  })
})
