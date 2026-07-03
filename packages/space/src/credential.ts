import * as crypto from 'node:crypto'
import { Keypair, verifySignature } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'

// JWT `typ` header values (proposal 0016).
export const DELEGATION_TOKEN_TYP = 'atproto-space-delegation+jwt'
export const SPACE_CREDENTIAL_TYP = 'atproto-space-credential+jwt'
export const CLIENT_ATTESTATION_TYP = 'atproto-client-attestation+jwt'

// JWT payloads

export type DelegationTokenPayload = {
  iss: string // user DID
  aud: string // space host (service fragment of the authority DID)
  sub: string // space URI being requested (at://authority/space/type/skey)
  iat: number // seconds since epoch
  exp: number // iat + 60 (60 seconds)
  jti: string // random nonce
}

export type SpaceCredentialPayload = {
  iss: string // space authority DID
  sub: string // space URI the credential reads
  iat: number
  exp: number // iat + 7200 (2 hours default)
  jti: string // random nonce
}

export type ClientAttestationPayload = {
  iss: string // the client_id
  sub: string // the client_id (== iss)
  aud: string // space host being asked for a credential
  iat: number
  exp: number
  jti: string // random nonce
}

type JwtHeader = {
  alg: string
  typ: string
  kid?: string
}

// Delegation token

export type CreateDelegationTokenOpts = {
  iss: string
  aud: string
  sub: string
  expSeconds?: number
}

export async function createDelegationToken(
  opts: CreateDelegationTokenOpts,
  keypair: Keypair,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (opts.expSeconds ?? 60) // 60 seconds
  const jti = crypto.randomUUID()

  const payload: DelegationTokenPayload = {
    iss: opts.iss,
    aud: opts.aud,
    sub: opts.sub,
    iat,
    exp,
    jti,
  }

  return createJwt(DELEGATION_TOKEN_TYP, payload, keypair, '#atproto')
}

export async function verifyDelegationToken(
  jwt: string,
  didKey: string,
): Promise<DelegationTokenPayload> {
  const parsed = parseJwt(jwt)

  if (parsed.header.typ !== DELEGATION_TOKEN_TYP) {
    throw new Error(
      `Invalid JWT type: expected ${DELEGATION_TOKEN_TYP}, got ${parsed.header.typ}`,
    )
  }

  const valid = await verifySignature(
    didKey,
    parsed.signingInput,
    parsed.signature,
    { jwtAlg: parsed.header.alg },
  )
  if (!valid) {
    throw new Error('Invalid JWT signature')
  }

  const payload = parsed.payload as DelegationTokenPayload

  const now = Math.floor(Date.now() / 1000)
  if (now > payload.exp) {
    throw new Error('JWT token expired')
  }

  return payload
}

// Space credential

export type CreateSpaceCredentialOpts = {
  iss: string
  sub: string
  expSeconds?: number
  kid?: string
}

export async function createSpaceCredential(
  opts: CreateSpaceCredentialOpts,
  keypair: Keypair,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (opts.expSeconds ?? 7200) // 2 hours default
  const jti = crypto.randomUUID()

  const payload: SpaceCredentialPayload = {
    iss: opts.iss,
    sub: opts.sub,
    iat,
    exp,
    jti,
  }

  // Signed by the authority's #atproto_space key, or #atproto when the
  // authority publishes no dedicated space key (proposal 0016).
  return createJwt(
    SPACE_CREDENTIAL_TYP,
    payload,
    keypair,
    opts.kid ?? '#atproto_space',
  )
}

export async function verifySpaceCredential(
  jwt: string,
  didKey: string,
): Promise<SpaceCredentialPayload> {
  const parsed = parseJwt(jwt)

  if (parsed.header.typ !== SPACE_CREDENTIAL_TYP) {
    throw new Error(
      `Invalid JWT type: expected ${SPACE_CREDENTIAL_TYP}, got ${parsed.header.typ}`,
    )
  }

  const valid = await verifySignature(
    didKey,
    parsed.signingInput,
    parsed.signature,
    { jwtAlg: parsed.header.alg },
  )
  if (!valid) {
    throw new Error('Invalid JWT signature')
  }

  const payload = parsed.payload as SpaceCredentialPayload

  const now = Math.floor(Date.now() / 1000)
  if (now > payload.exp) {
    throw new Error('JWT token expired')
  }

  return payload
}

// Client attestation
//
// @TODO Full verification requires resolving `iss` (the client_id) to the
// client's client-metadata.json, fetching its published JWKS, and verifying
// the signature against the key identified by the attestation's `kid`. That
// network-dependent verification is not implemented here; for now we only
// parse and structurally validate the attestation and surface its claims.
// See SPACE_RECONCILIATION_NOTES.md.

export type CreateClientAttestationOpts = {
  clientId: string
  aud: string
  kid?: string
  expSeconds?: number
}

// Build a client attestation. Apps sign these with their own client
// authentication key; this helper exists mainly so the shape is exercised in
// tests. The space authority verifies it against the client's published JWKS
// (not implemented here — see parseClientAttestation).
export async function createClientAttestation(
  opts: CreateClientAttestationOpts,
  keypair: Keypair,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (opts.expSeconds ?? 60)
  const jti = crypto.randomUUID()

  const payload: ClientAttestationPayload = {
    iss: opts.clientId,
    sub: opts.clientId,
    aud: opts.aud,
    iat,
    exp,
    jti,
  }

  return createJwt(CLIENT_ATTESTATION_TYP, payload, keypair, opts.kid)
}

export type ParsedClientAttestation = {
  header: JwtHeader
  payload: ClientAttestationPayload
}

export function parseClientAttestation(jwt: string): ParsedClientAttestation {
  const parsed = parseJwt(jwt)

  if (parsed.header.typ !== CLIENT_ATTESTATION_TYP) {
    throw new Error(
      `Invalid JWT type: expected ${CLIENT_ATTESTATION_TYP}, got ${parsed.header.typ}`,
    )
  }

  const payload = parsed.payload as ClientAttestationPayload
  if (!payload.iss || !payload.sub || !payload.aud) {
    throw new Error('Client attestation missing required claims (iss/sub/aud)')
  }
  if (payload.iss !== payload.sub) {
    throw new Error('Client attestation iss and sub must match (the client_id)')
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && now > payload.exp) {
    throw new Error('Client attestation expired')
  }

  return { header: parsed.header, payload }
}

// Internal JWT helpers

type ParsedJwt = {
  header: JwtHeader
  payload: Record<string, unknown>
  signingInput: Uint8Array
  signature: Uint8Array
}

async function createJwt(
  typ: string,
  payload: Record<string, unknown>,
  keypair: Keypair,
  kid?: string,
): Promise<string> {
  const header: JwtHeader = {
    alg: keypair.jwtAlg,
    typ,
  }
  if (kid) {
    header.kid = kid
  }

  const headerB64 = toBase64(
    new TextEncoder().encode(JSON.stringify(header)),
    'base64url',
  )
  const payloadB64 = toBase64(
    new TextEncoder().encode(JSON.stringify(payload)),
    'base64url',
  )

  const signingInput = `${headerB64}.${payloadB64}`
  const signingInputBytes = new TextEncoder().encode(signingInput)
  const signature = await keypair.sign(signingInputBytes)
  const signatureB64 = toBase64(signature, 'base64url')

  return `${signingInput}.${signatureB64}`
}

function parseJwt(jwt: string): ParsedJwt {
  const parts = jwt.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT: expected 3 parts')
  }

  const [headerB64, payloadB64, signatureB64] = parts

  let header: JwtHeader
  try {
    const headerJson = new TextDecoder().decode(
      fromBase64(headerB64, 'base64url'),
    )
    header = JSON.parse(headerJson)
  } catch (err) {
    throw new Error(`Invalid JWT header: ${err}`)
  }

  let payload: Record<string, unknown>
  try {
    const payloadJson = new TextDecoder().decode(
      fromBase64(payloadB64, 'base64url'),
    )
    payload = JSON.parse(payloadJson)
  } catch (err) {
    throw new Error(`Invalid JWT payload: ${err}`)
  }

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = fromBase64(signatureB64, 'base64url')

  return {
    header,
    payload,
    signingInput,
    signature,
  }
}
