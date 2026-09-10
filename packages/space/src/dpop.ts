import { EmbeddedJWK, calculateJwkThumbprint, errors, jwtVerify } from 'jose'
import { randomStr, sha256 } from '@atproto/crypto'
import type { Key } from '@atproto/jwk'
import { toBase64 } from '@atproto/lex-data'
import { CLOCK_SKEW_SEC } from './credential.js'
import { DpopProofError } from './error.js'

/**
 * DPoP binding for space credentials (RFC 9449).
 *
 * A credential reads a whole space and is presented to every repo host in it. As a
 * bearer token it would be a shared secret: a host given one to serve its own repo
 * could replay it against every other host in the space.
 */

export const DPOP_PROOF_TYP = 'dpop+jwt'
export const MAX_PROOF_AGE_SEC = 60
const SIGNING_ALG = 'ES256'

export type DpopProof = {
  jti: string
  jkt: string
  htm: string
  htu: string
}

export type CreateDpopProofOpts = {
  htm: string
  htu: string
  /** Present when proving possession of a key bound to an access credential. */
  credential?: string
}

export const createDpopProof = async (
  key: Key,
  opts: CreateDpopProofOpts,
): Promise<string> => {
  const jwk = key.bareJwk
  if (!jwk) {
    throw new DpopProofError('a DPoP proof requires an asymmetric key')
  }
  if (!key.algorithms.includes(SIGNING_ALG)) {
    throw new DpopProofError(
      `a DPoP key must support ${SIGNING_ALG}, got: ${key.algorithms.join(', ')}`,
    )
  }

  return key.createJwt(
    { alg: SIGNING_ALG, typ: DPOP_PROOF_TYP, jwk },
    {
      jti: randomStr(16, 'hex'),
      htm: opts.htm,
      htu: normalizeHtu(opts.htu),
      ...(opts.credential !== undefined
        ? { ath: await hashCredential(opts.credential) }
        : undefined),
      iat: Math.floor(Date.now() / 1000),
    },
  )
}

type DpopRequest = {
  htm: string
  htu: string
}

export type VerifyDpopProofOpts = DpopRequest &
  (
    | {
        credential: string
        jkt: string
      }
    | {
        credential?: undefined
        jkt?: undefined
      }
  )

/** Checks everything but replay; the caller records the returned `jti` itself. */
export const verifyDpopProof = async (
  proof: string,
  opts: VerifyDpopProofOpts,
): Promise<DpopProof> => {
  // EmbeddedJWK verifies against the proof's own `jwk` header; the thumbprint
  // comparison below is what ties that key to the credential.
  //
  // Without the skew allowance a holder whose clock runs even slightly fast is
  // rejected outright, since jose refuses an `iat` in the verifier's future.
  const { protectedHeader, payload } = await jwtVerify(proof, EmbeddedJWK, {
    typ: DPOP_PROOF_TYP,
    algorithms: [SIGNING_ALG],
    maxTokenAge: MAX_PROOF_AGE_SEC,
    clockTolerance: CLOCK_SKEW_SEC,
  }).catch((err) => {
    if (err instanceof errors.JWTExpired) {
      throw new DpopProofError(
        `DPoP proof is expired: ${errMsg(err)}`,
        'DpopProofExpired',
      )
    }
    throw new DpopProofError(
      `could not verify DPoP proof: ${errMsg(err)}`,
      'BadDpopProofSignature',
    )
  })

  const { jti, htm, htu, ath } = payload
  if (typeof jti !== 'string' || !jti) {
    throw new DpopProofError('missing DPoP proof "jti"')
  }
  if (htm !== opts.htm) {
    throw new DpopProofError('DPoP proof "htm" does not match the request')
  }
  if (typeof htu !== 'string' || htu !== normalizeHtu(opts.htu)) {
    throw new DpopProofError('DPoP proof "htu" does not match the request')
  }
  if (opts.credential !== undefined) {
    if (ath !== (await hashCredential(opts.credential))) {
      throw new DpopProofError('DPoP proof "ath" does not match the credential')
    }
  } else if (ath !== undefined) {
    throw new DpopProofError(
      'DPoP proof "ath" must be omitted when obtaining a credential',
    )
  }

  // Present because jwtVerify used EmbeddedJWK.
  const jkt = await calculateJwkThumbprint(
    protectedHeader.jwk!,
    'sha256',
  ).catch((err) => {
    throw new DpopProofError(
      `could not compute DPoP key thumbprint: ${errMsg(err)}`,
    )
  })
  if (opts.jkt !== undefined && jkt !== opts.jkt) {
    throw new DpopProofError(
      'DPoP proof is not signed by the key the credential is bound to',
      'DpopKeyMismatch',
    )
  }

  return { jti, jkt, htm, htu }
}

/** The RFC 7638 thumbprint of a DPoP key. */
export const dpopJktForKey = async (key: Key): Promise<string> => {
  const jwk = key.bareJwk
  if (!jwk) {
    throw new DpopProofError('a DPoP key must be asymmetric')
  }
  return calculateJwkThumbprint(jwk, 'sha256')
}

// Strips query and fragment (RFC 9449 §4.2), so one proof covers any query on a path.
const normalizeHtu = (url: string): string => {
  const parsed = new URL(url)
  return parsed.origin + parsed.pathname
}

const hashCredential = async (credential: string): Promise<string> => {
  return toBase64(await sha256(credential), 'base64url')
}

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
