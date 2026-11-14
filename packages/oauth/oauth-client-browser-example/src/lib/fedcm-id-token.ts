import {
  SECP256K1_JWT_ALG,
  formatDidKey,
  multibaseToBytes,
  verifySignature,
} from '@atproto/crypto'
import {
  type AtprotoDid,
  type AtprotoIdentityDidMethods,
  type DidDocument,
  extractAtprotoData,
  isAtprotoDid,
} from '@atproto/did'
import { fromBase64, utf8FromBytes } from '@atproto/lex'

const ID_TOKEN_TYP = 'atproto-id+jwt'
const HANDLE_INVALID = 'handle.invalid'

export type VerifiedFedcmIdentity = {
  did: AtprotoDid
  /** `undefined` when the handle does not verify bidirectionally. */
  handle: string | undefined
  authTime: number | undefined
}

export type FedcmIdentityResolver = (
  did: AtprotoDid,
) => Promise<{ didDoc: DidDocument<AtprotoIdentityDidMethods>; handle: string }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeJsonSegment(segment: string, name: string): unknown {
  try {
    return JSON.parse(utf8FromBytes(fromBase64(segment, 'base64url')))
  } catch (cause) {
    throw new Error(`Invalid id token ${name}`, { cause })
  }
}

/**
 * Verifies the id token returned by the PDS's FedCM assertion endpoint against
 * the signing key published in the account's DID document.
 */
export async function verifyFedcmIdToken(
  token: unknown,
  opts: {
    clientId: string
    nonce: string
    resolve: FedcmIdentityResolver
    /** Milliseconds since epoch. */
    now?: number
    skewSeconds?: number
  },
): Promise<VerifiedFedcmIdentity> {
  if (typeof token !== 'string') throw new Error('Id token must be a string')

  const segments = token.split('.')
  if (segments.length !== 3) throw new Error('Id token is not a compact JWS')
  const [headerSeg, payloadSeg, sigSeg] = segments

  const header = decodeJsonSegment(headerSeg, 'header')
  const payload = decodeJsonSegment(payloadSeg, 'payload')
  if (!isRecord(header)) throw new Error('Invalid id token header')
  if (!isRecord(payload)) throw new Error('Invalid id token payload')

  if (header.typ !== ID_TOKEN_TYP) {
    throw new Error(`Unexpected id token typ: ${String(header.typ)}`)
  }
  if (typeof header.alg !== 'string') {
    throw new Error('Id token header has no alg')
  }

  const { sub } = payload
  if (typeof sub !== 'string' || !isAtprotoDid(sub)) {
    throw new Error('Id token sub is not an atproto DID')
  }
  if (payload.iss !== sub) throw new Error('Id token iss does not match sub')
  if (header.kid !== `${sub}#atproto`) {
    throw new Error('Id token kid does not reference the sub atproto key')
  }
  if (payload.aud !== opts.clientId) {
    throw new Error('Id token aud does not match the client_id')
  }
  if (payload.nonce !== opts.nonce) {
    throw new Error('Id token nonce does not match')
  }

  const { exp, auth_time: authTime } = payload
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new Error('Id token has no valid exp')
  }
  const nowSeconds = (opts.now ?? Date.now()) / 1000
  if (exp < nowSeconds - (opts.skewSeconds ?? 30)) {
    throw new Error('Id token is expired')
  }
  if (authTime !== undefined && typeof authTime !== 'number') {
    throw new Error('Id token auth_time is invalid')
  }

  const { didDoc, handle } = await opts.resolve(sub)
  if (didDoc.id !== sub) throw new Error('Resolved DID document id mismatch')

  const key = extractAtprotoData(didDoc).key
  if (!key) throw new Error('DID document has no #atproto verification method')
  let didKey: string
  if (key.type === 'Multikey') {
    didKey = `did:key:${key.publicKeyMultibase}`
  } else if (key.type === 'EcdsaSecp256k1VerificationKey2019') {
    didKey = formatDidKey(
      SECP256K1_JWT_ALG,
      multibaseToBytes(key.publicKeyMultibase),
    )
  } else {
    throw new Error(`Unsupported #atproto key type: ${key.type}`)
  }
  const signingInput = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`)
  let valid: boolean
  try {
    valid = await verifySignature(
      didKey,
      signingInput,
      fromBase64(sigSeg, 'base64url'),
      { jwtAlg: header.alg },
    )
  } catch (cause) {
    throw new Error('Id token signature could not be verified', { cause })
  }
  if (!valid) throw new Error('Id token signature is invalid')

  return {
    did: sub,
    handle: handle === HANDLE_INVALID ? undefined : handle,
    authTime,
  }
}
