import { type Signer, randomStr, verifySignature } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import {
  type DidString,
  type SpaceRefString,
  isValidDid,
} from '@atproto/syntax'
import { utf8 } from './bytes.js'
import { SpaceTokenError } from './error.js'

/**
 * How a space authority is addressed when acting as the space host: the service
 * entry a delegation token and a client attestation name as their audience. The
 * space host is the authority's PDS, like any other atproto account.
 */
export function spaceHostAud(spaceDid: DidString): `${DidString}#atproto_pds` {
  return `${spaceDid}#atproto_pds`
}

export const DELEGATION_TOKEN_TYP = 'atproto-space-delegation+jwt'
export const SPACE_CREDENTIAL_TYP = 'atproto-space-credential+jwt'
export const CLIENT_ATTESTATION_TYP = 'atproto-client-attestation+jwt'

// @NOTE credentials carry no audience; HTTP message signatures bind each use to an audience DID.
const SPACE_TOKEN_TYPES = {
  delegation: {
    typ: DELEGATION_TOKEN_TYP,
    kid: '#atproto',
    expiresInSec: 60,
    requireAud: true,
    requireCnf: false,
    singleUse: true,
  },
  credential: {
    typ: SPACE_CREDENTIAL_TYP,
    kid: '#atproto',
    expiresInSec: 600,
    requireAud: false,
    requireCnf: true,
    singleUse: false,
  },
  clientAttestation: {
    typ: CLIENT_ATTESTATION_TYP,
    kid: undefined,
    expiresInSec: 60,
    requireAud: true,
    requireCnf: false,
    singleUse: true,
  },
} as const

export type SpaceTokenType = keyof typeof SPACE_TOKEN_TYPES
export type SpaceTokenHeaderTyp =
  (typeof SPACE_TOKEN_TYPES)[keyof typeof SPACE_TOKEN_TYPES]['typ']

// `sub` is the space URI, or the client_id for a client attestation. `cnf` is
// always present on the token types that require it.
export type SpaceTokenPayload<T extends SpaceTokenType = SpaceTokenType> = {
  iss: string
  sub: string
  aud?: string
  iat: number
  exp: number
  jti: string
} & ((typeof SPACE_TOKEN_TYPES)[T]['requireCnf'] extends true
  ? { cnf: { kid: DidString } }
  : { cnf?: { kid: DidString } })

export type SpaceTokenHeader = {
  alg: string
  typ: SpaceTokenHeaderTyp
  kid?: string
}

export type SpaceToken<T extends SpaceTokenType = SpaceTokenType> = {
  header: SpaceTokenHeader
  payload: SpaceTokenPayload<T>
}

export const CLOCK_SKEW_SEC = 5
export const SPACE_CREDENTIAL_MAX_AGE_SEC = 3600

/** A user's authorization for an app to request a space credential on its behalf. */
export async function createDelegationToken(opts: {
  iss: DidString
  sub: SpaceRefString
  aud: string
  keypair: Signer
  expiresInSec?: number
}): Promise<string> {
  const spec = SPACE_TOKEN_TYPES.delegation
  const token = buildSpaceToken(
    { typ: spec.typ, kid: spec.kid },
    { iss: opts.iss, sub: opts.sub, aud: opts.aud },
    opts.expiresInSec ?? spec.expiresInSec,
  )
  return signSpaceToken(token, opts.keypair)
}

/** A space authority's grant to read a space, bound to the holder's `keyId`. */
export async function createSpaceCredential(opts: {
  iss: DidString
  sub: SpaceRefString
  keyId: DidString
  keypair: Signer
  expiresInSec?: number
}): Promise<string> {
  const spec = SPACE_TOKEN_TYPES.credential
  const expiresInSec = opts.expiresInSec ?? spec.expiresInSec
  if (
    !Number.isFinite(expiresInSec) ||
    expiresInSec <= 0 ||
    expiresInSec > SPACE_CREDENTIAL_MAX_AGE_SEC
  ) {
    throw new SpaceTokenError('invalid space credential lifetime')
  }
  const token = buildSpaceToken(
    { typ: spec.typ, kid: spec.kid },
    { iss: opts.iss, sub: opts.sub, cnf: { kid: opts.keyId } },
    expiresInSec,
  )
  return signSpaceToken(token, opts.keypair)
}

export type ClientAttestationOpts = {
  clientId: string
  aud: string
  kid?: string
  expiresInSec?: number
}

/**
 * An OAuth client's proof of identity to a space host, signed with a key from the
 * client's JWKS (named by `kid`).
 */
export async function createClientAttestation(
  opts: ClientAttestationOpts & { keypair: Signer },
): Promise<string> {
  return signSpaceToken(buildClientAttestation(opts), opts.keypair)
}

/** A space token's header (without `alg`) and claims, ready to sign. */
export type UnsignedSpaceToken = {
  header: Omit<SpaceTokenHeader, 'alg'>
  payload: SpaceTokenPayload
}

/**
 * Builds a client attestation for any JWT signer, e.g. an `@atproto/jwk`
 * `Keyset`, which picks the key and sets `alg` itself.
 * {@link createClientAttestation} signs with a `Signer`.
 *
 * @example
 * ```ts
 * const { header, payload } = buildClientAttestation({
 *   clientId,
 *   aud: spaceHostAud(spaceDid),
 * })
 * const jwt = await keyset.createJwt(header, payload)
 * ```
 */
export function buildClientAttestation(
  opts: ClientAttestationOpts,
): UnsignedSpaceToken {
  const spec = SPACE_TOKEN_TYPES.clientAttestation
  return buildSpaceToken(
    { typ: spec.typ, kid: opts.kid },
    { iss: opts.clientId, sub: opts.clientId, aud: opts.aud },
    opts.expiresInSec ?? spec.expiresInSec,
  )
}

function buildSpaceToken(
  header: Omit<SpaceTokenHeader, 'alg'>,
  claims: Pick<SpaceTokenPayload, 'iss' | 'sub' | 'aud' | 'cnf'>,
  expiresInSec: number,
): UnsignedSpaceToken {
  const iat = Math.floor(Date.now() / 1000)
  return {
    header: {
      typ: header.typ,
      ...(header.kid ? { kid: header.kid } : undefined),
    },
    payload: {
      ...claims,
      iat,
      exp: iat + expiresInSec,
      jti: randomStr(16, 'hex'),
    },
  }
}

async function signSpaceToken(
  token: UnsignedSpaceToken,
  signer: Signer,
): Promise<string> {
  const header: SpaceTokenHeader = { alg: signer.jwtAlg, ...token.header }
  const signingInput = `${jsonToB64Url(header)}.${jsonToB64Url(token.payload)}`
  const sig = await signer.sign(utf8(signingInput))
  return `${signingInput}.${toBase64(sig, 'base64url')}`
}

// Structural validation only, no signature check. This is as far as we go for
// client attestations, whose key comes from the client's JWKS, not a DID doc.
export function parseSpaceToken<T extends SpaceTokenType>(
  type: T,
  jwt: string,
): SpaceToken<T> & { signingInput: Uint8Array; sig: Uint8Array } {
  const spec = SPACE_TOKEN_TYPES[type]

  const parts = jwt.split('.')
  if (parts.length !== 3) {
    throw new SpaceTokenError('malformed token: expected 3 parts', 'BadJwt')
  }
  const [headerB64, payloadB64, sigB64] = parts

  const header = decodeJsonPart<SpaceTokenHeader>(headerB64, 'header')
  const payload = decodeJsonPart<SpaceTokenPayload<T>>(payloadB64, 'payload')

  if (header.typ !== spec.typ) {
    throw new SpaceTokenError(
      `wrong token type: expected "${spec.typ}", got "${header.typ}"`,
      'BadJwtType',
    )
  }
  if (typeof header.alg !== 'string' || !header.alg) {
    throw new SpaceTokenError('missing token "alg"', 'BadJwt')
  }
  if (spec.kid && header.kid !== spec.kid) {
    throw new SpaceTokenError(
      `wrong token "kid": expected "${spec.kid}", got "${header.kid}"`,
      'BadJwt',
    )
  }
  if (!payload.iss) {
    throw new SpaceTokenError('missing token "iss"', 'BadJwtIss')
  }
  if (!payload.sub) {
    throw new SpaceTokenError('missing token "sub"', 'BadJwtSub')
  }
  if (!Number.isFinite(payload.exp)) {
    throw new SpaceTokenError('missing token "exp"', 'BadJwt')
  }
  if (spec.requireAud && !payload.aud) {
    throw new SpaceTokenError('missing token "aud"', 'BadJwtAudience')
  }
  if (spec.requireCnf && !isValidDid(payload.cnf?.kid)) {
    throw new SpaceTokenError('missing token "cnf.kid"', 'BadJwtCnf')
  }
  if (typeof payload.jti !== 'string' || !payload.jti) {
    throw new SpaceTokenError(`a ${type} token requires a "jti"`, 'BadJwt')
  }
  if (
    type === 'credential' &&
    (!Number.isFinite(payload.iat) ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > SPACE_CREDENTIAL_MAX_AGE_SEC)
  ) {
    throw new SpaceTokenError('invalid space credential lifetime', 'BadJwt')
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
    signingInput: utf8(`${headerB64}.${payloadB64}`),
    sig: fromBase64(sigB64, 'base64url'),
  }
}

export type VerifySpaceTokenOpts = {
  getSigningKey: (
    iss: string,
    forceRefresh: boolean,
  ) => string | Promise<string>
  aud?: string
  sub?: string
}

export async function verifySpaceToken<T extends SpaceTokenType>(
  type: T,
  jwt: string,
  opts: VerifySpaceTokenOpts,
): Promise<SpaceToken<T>> {
  const { header, payload, signingInput, sig } = parseSpaceToken(type, jwt)

  const now = Math.floor(Date.now() / 1000)
  if (type === 'credential' && payload.iat > now + CLOCK_SKEW_SEC) {
    throw new SpaceTokenError('space credential issued in the future', 'BadJwt')
  }
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
  const didKey = await opts.getSigningKey(payload.iss, false)
  if (await matchesSignature(didKey, header, signingInput, sig)) {
    return { header, payload }
  }

  // The signing key may have rotated since the one we hold was cached.
  const freshDidKey = await opts.getSigningKey(payload.iss, true)
  if (
    freshDidKey !== didKey &&
    (await matchesSignature(freshDidKey, header, signingInput, sig))
  ) {
    return { header, payload }
  }

  throw new SpaceTokenError('invalid token signature', 'BadJwtSignature')
}

async function matchesSignature(
  didKey: string,
  header: SpaceTokenHeader,
  signingInput: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> {
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

function jsonToB64Url(json: Record<string, unknown>): string {
  return toBase64(utf8(JSON.stringify(json)), 'base64url')
}

function decodeJsonPart<T>(b64: string, part: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64(b64, 'base64url')))
  } catch (err) {
    throw new SpaceTokenError(
      `could not parse token ${part}: ${errMsg(err)}`,
      'BadJwt',
    )
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
