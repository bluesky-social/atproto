import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sha256 } from '@atproto/crypto'
import { JoseKey } from '@atproto/jwk-jose'
import { toBase64 } from '@atproto/lex-data'
import {
  MAX_PROOF_AGE_SEC,
  createDpopProof,
  dpopJktForKey,
  verifyDpopProof,
} from '../src/index.js'

const CREDENTIAL = 'eyJ0eXAiOiJhdHByb3RvLXNwYWNlLWNyZWRlbnRpYWwrand0'
const HTU = 'https://pds.example.com/xrpc/com.atproto.space.getRepo'
const HTM = 'GET'
const EXCHANGE_HTU =
  'https://space.example.com/xrpc/com.atproto.space.getSpaceCredential'

const athFor = async (credential: string): Promise<string> =>
  toBase64(await sha256(credential), 'base64url')

describe('DPoP proofs', () => {
  let key: JoseKey
  let otherKey: JoseKey

  beforeAll(async () => {
    ;[key, otherKey] = await Promise.all([
      JoseKey.generate(['ES256']),
      JoseKey.generate(['ES256']),
    ])
  })

  const verifyAgainst = (
    proof: string,
    overrides: Partial<Parameters<typeof verifyDpopProof>[1]> = {},
  ) =>
    verifyDpopProof(proof, {
      htm: HTM,
      htu: HTU,
      credential: CREDENTIAL,
      jkt: overrides.jkt ?? '',
      ...overrides,
    })

  it('round-trips a proof for the request it was minted for', async () => {
    const jkt = await dpopJktForKey(key)
    const proof = await createDpopProof(key, {
      htm: HTM,
      htu: HTU,
      credential: CREDENTIAL,
    })

    const verified = await verifyAgainst(proof, { jkt })
    expect(verified.jkt).toBe(jkt)
    expect(verified.htm).toBe(HTM)
    expect(verified.htu).toBe(HTU)
    expect(verified.jti).toBeTruthy()
  })

  it('derives a key binding from a credential exchange proof without ath', async () => {
    const proof = await createDpopProof(key, {
      htm: 'POST',
      htu: EXCHANGE_HTU,
    })

    await expect(
      verifyDpopProof(proof, { htm: 'POST', htu: EXCHANGE_HTU }),
    ).resolves.toMatchObject({ jkt: await dpopJktForKey(key) })
  })

  it('refuses ath on a credential exchange proof', async () => {
    const proof = await createDpopProof(key, {
      htm: 'POST',
      htu: EXCHANGE_HTU,
      credential: CREDENTIAL,
    })

    await expect(
      verifyDpopProof(proof, { htm: 'POST', htu: EXCHANGE_HTU }),
    ).rejects.toThrow(/"ath" must be omitted/)
  })

  it('mints a distinct jti per proof, so a verifier can reject replays', async () => {
    const opts = { htm: HTM, htu: HTU, credential: CREDENTIAL }
    const first = await verifyAgainst(await createDpopProof(key, opts), {
      jkt: await dpopJktForKey(key),
    })
    const second = await verifyAgainst(await createDpopProof(key, opts), {
      jkt: await dpopJktForKey(key),
    })
    expect(first.jti).not.toBe(second.jti)
  })

  it('strips query and fragment from htu, on both sides', async () => {
    const proof = await createDpopProof(key, {
      htm: HTM,
      htu: `${HTU}?space=at%3A%2F%2Fdid%3Aexample%3Aspace&repo=did%3Aexample%3Abob`,
      credential: CREDENTIAL,
    })
    const verified = await verifyAgainst(proof, {
      jkt: await dpopJktForKey(key),
      htu: `${HTU}?space=something&repo=else`,
    })
    expect(verified.htu).toBe(HTU)
  })

  it('refuses a proof signed by a key the credential is not bound to', async () => {
    const proof = await createDpopProof(otherKey, {
      htm: HTM,
      htu: HTU,
      credential: CREDENTIAL,
    })
    await expect(
      verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
    ).rejects.toMatchObject({ code: 'DpopKeyMismatch' })
  })

  it('refuses a proof addressed to another host', async () => {
    const proof = await createDpopProof(key, {
      htm: HTM,
      htu: 'https://other-pds.example.com/xrpc/com.atproto.space.getRepo',
      credential: CREDENTIAL,
    })
    await expect(
      verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
    ).rejects.toThrow(/"htu" does not match/)
  })

  it('refuses a proof minted for another method', async () => {
    const proof = await createDpopProof(key, {
      htm: 'POST',
      htu: HTU,
      credential: CREDENTIAL,
    })
    await expect(
      verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
    ).rejects.toThrow(/"htm" does not match/)
  })

  it('refuses a proof paired with a different credential', async () => {
    const proof = await createDpopProof(key, {
      htm: HTM,
      htu: HTU,
      credential: 'a-different-credential',
    })
    await expect(
      verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
    ).rejects.toThrow(/"ath" does not match/)
  })

  it('refuses a stale proof, as expired rather than unverifiable', async () => {
    const proof = await createDpopProof(key, {
      htm: HTM,
      htu: HTU,
      credential: CREDENTIAL,
    })
    const jkt = await dpopJktForKey(key)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.now() + (MAX_PROOF_AGE_SEC + 60) * 1000)
      await expect(verifyAgainst(proof, { jkt })).rejects.toMatchObject({
        code: 'DpopProofExpired',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  describe('clock skew', () => {
    /** Mint a proof as though this host's clock were `offsetMs` off from ours. */
    const proofWithClockOffset = async (offsetMs: number): Promise<string> => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(Date.now() + offsetMs)
        return await createDpopProof(key, {
          htm: HTM,
          htu: HTU,
          credential: CREDENTIAL,
        })
      } finally {
        vi.useRealTimers()
      }
    }

    it('accepts a proof from a holder whose clock runs slightly fast', async () => {
      // Regression: without clockTolerance this is a hard 401, and only between real
      // machines — it looks like an intermittent auth error.
      const proof = await proofWithClockOffset(2_000)
      await expect(
        verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
      ).resolves.toBeTruthy()
    })

    it('accepts a proof from a holder whose clock runs slightly slow', async () => {
      const proof = await proofWithClockOffset(-2_000)
      await expect(
        verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
      ).resolves.toBeTruthy()
    })

    it('still refuses a proof dated far in the future', async () => {
      const proof = await proofWithClockOffset((MAX_PROOF_AGE_SEC + 60) * 1000)
      await expect(
        verifyAgainst(proof, { jkt: await dpopJktForKey(key) }),
      ).rejects.toMatchObject({ code: 'BadDpopProofSignature' })
    })
  })

  it('refuses a proof signed with an algorithm outside the allowed set', async () => {
    // Signed directly rather than through createDpopProof, which refuses the key
    // outright. The signature is valid and the thumbprint matches, so only the
    // algorithm restriction stands between this proof and being honoured.
    const rsaKey = await JoseKey.generate(['RS256'])
    const proof = await rsaKey.createJwt(
      { alg: 'RS256', typ: 'dpop+jwt', jwk: rsaKey.bareJwk },
      {
        jti: 'rsa-proof',
        htm: HTM,
        htu: HTU,
        ath: await athFor(CREDENTIAL),
        iat: Math.floor(Date.now() / 1000),
      },
    )
    await expect(
      verifyAgainst(proof, { jkt: await dpopJktForKey(rsaKey) }),
    ).rejects.toMatchObject({ code: 'BadDpopProofSignature' })
  })

  it('refuses a token that is not a proof', async () => {
    await expect(
      verifyAgainst(CREDENTIAL, { jkt: await dpopJktForKey(key) }),
    ).rejects.toMatchObject({ code: 'BadDpopProofSignature' })
  })
})
