import { type Keypair, randomStr, verifySignature } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import { SpaceTokenError } from './error.js'

/**
 * How a space authority is addressed when acting as the space host: the service
 * entry a delegation token and a client attestation name as their audience. Note
 * this is the *audience*, not necessarily where requests are sent — an authority
 * that publishes no such entry is still reached at its `#atproto_pds` endpoint.
 */
export const spaceHostAud = (spaceDid: string): string =>
  `${spaceDid}#atproto_space_host`

// The three token classes share a wire shape and differ only in who signs them,
// who they're addressed to, and how long they live — hence data, not three impls.
// A credential is multi-use across repo hosts, so it carries no aud; it is bound
// to the holder's DPoP key instead (see dpop.ts).
export const SPACE_TOKEN_TYPES = {
  delegation: {
    typ: 'atproto-space-delegation+jwt',
    kid: '#atproto',
    expiresInSec: 60,
    requireAud: true,
    requireCnf: false,
    singleUse: true,
  },
  // An authority that publishes a dedicated `#atproto_space` key signs with it
  // and passes that `kid`. Absent one, the space signing key is the account's
  // `#atproto` key, which is the case for any authority hosted on a PDS.
  credential: {
    typ: 'atproto-space-credential+jwt',
    kid: '#atproto',
    expiresInSec: 7200,
    requireAud: false,
    requireCnf: true,
    singleUse: false,
  },
  clientAttestation: {
    typ: 'atproto-client-attestation+jwt',
    kid: undefined,
    expiresInSec: 60,
    requireAud: true,
    requireCnf: false,
    singleUse: true,
  },
} as const

export type SpaceTokenType = keyof typeof SPACE_TOKEN_TYPES

// `sub` is the space URI, or the client_id for a client attestation.
export type SpaceTokenPayload = {
  iss: string
  sub: string
  aud?: string
  iat: number
  exp: number
  jti: string
  cnf?: { jkt: string }
}

export type SpaceTokenHeader = {
  alg: string
  typ: string
  kid?: string
}

export type SpaceToken = {
  header: SpaceTokenHeader
  payload: SpaceTokenPayload
}

export const CLOCK_SKEW_SEC = 5

export type CreateSpaceTokenOpts = {
  iss: string
  sub: string
  aud?: string
  dpopJkt?: string
  expiresInSec?: number
  kid?: string
}

export const createSpaceToken = async (
  type: SpaceTokenType,
  opts: CreateSpaceTokenOpts,
  keypair: Keypair,
): Promise<string> => {
  const spec = SPACE_TOKEN_TYPES[type]
  if (spec.requireAud && !opts.aud) {
    throw new SpaceTokenError(`a ${type} token requires an "aud"`)
  }
  if (spec.requireCnf && !opts.dpopJkt) {
    throw new SpaceTokenError(`a ${type} token requires a "dpopJkt"`)
  }

  const iat = Math.floor(Date.now() / 1000)
  const header: SpaceTokenHeader = { alg: keypair.jwtAlg, typ: spec.typ }
  const kid = opts.kid ?? spec.kid
  if (kid) header.kid = kid

  const payload: SpaceTokenPayload = {
    iss: opts.iss,
    sub: opts.sub,
    ...(opts.aud ? { aud: opts.aud } : undefined),
    ...(opts.dpopJkt ? { cnf: { jkt: opts.dpopJkt } } : undefined),
    iat,
    exp: iat + (opts.expiresInSec ?? spec.expiresInSec),
    jti: randomStr(16, 'hex'),
  }

  const signingInput = `${jsonToB64Url(header)}.${jsonToB64Url(payload)}`
  const sig = await keypair.sign(new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64(sig, 'base64url')}`
}

// Structural validation only, no signature check. This is as far as we go for
// client attestations, whose key comes from the client's JWKS, not a DID doc.
export const parseSpaceToken = (
  type: SpaceTokenType,
  jwt: string,
): SpaceToken & { signingInput: Uint8Array; sig: Uint8Array } => {
  const spec = SPACE_TOKEN_TYPES[type]

  const parts = jwt.split('.')
  if (parts.length !== 3) {
    throw new SpaceTokenError('malformed token: expected 3 parts', 'BadJwt')
  }
  const [headerB64, payloadB64, sigB64] = parts

  const header = decodeJsonPart<SpaceTokenHeader>(headerB64, 'header')
  const payload = decodeJsonPart<SpaceTokenPayload>(payloadB64, 'payload')

  if (header.typ !== spec.typ) {
    throw new SpaceTokenError(
      `wrong token type: expected "${spec.typ}", got "${header.typ}"`,
      'BadJwtType',
    )
  }
  if (typeof header.alg !== 'string' || !header.alg) {
    throw new SpaceTokenError('missing token "alg"', 'BadJwt')
  }
  if (!payload.iss) {
    throw new SpaceTokenError('missing token "iss"', 'BadJwtIss')
  }
  if (!payload.sub) {
    throw new SpaceTokenError('missing token "sub"', 'BadJwtSub')
  }
  if (typeof payload.exp !== 'number') {
    throw new SpaceTokenError('missing token "exp"', 'BadJwt')
  }
  if (spec.requireAud && !payload.aud) {
    throw new SpaceTokenError('missing token "aud"', 'BadJwtAudience')
  }
  if (spec.requireCnf && !payload.cnf?.jkt) {
    throw new SpaceTokenError('missing token "cnf.jkt"', 'BadJwtCnf')
  }
  if (spec.singleUse && (typeof payload.jti !== 'string' || !payload.jti)) {
    throw new SpaceTokenError(
      `a ${type} token requires a "jti" to be consumed by`,
      'BadJwt',
    )
  }
  if (type === 'clientAttestation' && payload.iss !== payload.sub) {
    throw new SpaceTokenError(
      'client attestation "iss" and "sub" must both be the client_id',
      'BadJwtIss',
    )
  }

  return {
    header,
    payload,
    signingInput: new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    sig: fromBase64(sigB64, 'base64url'),
  }
}

export type VerifySpaceTokenOpts = {
  /** Passed `kid` so a verifier can honour the key id. */
  getSigningKey: (
    iss: string,
    kid: string | undefined,
    forceRefresh: boolean,
  ) => string | Promise<string>
  aud?: string
  sub?: string
}

export const verifySpaceToken = async (
  type: SpaceTokenType,
  jwt: string,
  opts: VerifySpaceTokenOpts,
): Promise<SpaceToken> => {
  const { header, payload, signingInput, sig } = parseSpaceToken(type, jwt)

  const now = Math.floor(Date.now() / 1000)
  if (now - CLOCK_SKEW_SEC >= payload.exp) {
    throw new SpaceTokenError('token expired', 'JwtExpired')
  }
  if (opts.aud !== undefined && payload.aud !== opts.aud) {
    throw new SpaceTokenError(
      'token audience does not match this service',
      'BadJwtAudience',
    )
  }
  if (opts.sub !== undefined && payload.sub !== opts.sub) {
    throw new SpaceTokenError(
      'token subject does not match the requested space',
      'BadJwtSub',
    )
  }
  const didKey = await opts.getSigningKey(payload.iss, header.kid, false)
  if (await matchesSignature(didKey, header, signingInput, sig)) {
    return { header, payload }
  }

  // The signing key may have rotated since the one we hold was cached.
  const freshDidKey = await opts.getSigningKey(payload.iss, header.kid, true)
  if (
    freshDidKey !== didKey &&
    (await matchesSignature(freshDidKey, header, signingInput, sig))
  ) {
    return { header, payload }
  }

  throw new SpaceTokenError('invalid token signature', 'BadJwtSignature')
}

const matchesSignature = async (
  didKey: string,
  header: SpaceTokenHeader,
  signingInput: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> => {
  try {
    return await verifySignature(didKey, signingInput, sig, {
      jwtAlg: header.alg,
    })
  } catch (err) {
    throw new SpaceTokenError(
      `could not verify token signature: ${errMsg(err)}`,
      'BadJwtSignature',
    )
  }
}

const jsonToB64Url = (json: Record<string, unknown>): string =>
  toBase64(new TextEncoder().encode(JSON.stringify(json)), 'base64url')

const decodeJsonPart = <T>(b64: string, part: string): T => {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64(b64, 'base64url')))
  } catch (err) {
    throw new SpaceTokenError(
      `could not parse token ${part}: ${errMsg(err)}`,
      'BadJwt',
    )
  }
}

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
