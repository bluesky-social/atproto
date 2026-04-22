import * as crypto from 'node:crypto'
import { Keypair, verifySignature } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'

// JWT Types

export type MemberGrantPayload = {
  iss: string // member DID
  aud: string // space owner DID
  space: string // space URI
  clientId: string // OAuth client ID
  lxm: 'com.atproto.space.getSpaceCredential'
  iat: number // seconds since epoch
  exp: number // iat + 300 (5 minutes)
  jti: string // random nonce
}

export type SpaceCredentialPayload = {
  iss: string // space owner DID
  space: string // space URI
  clientId: string // OAuth client ID
  iat: number
  exp: number // iat + 7200 (2 hours default)
  jti: string // random nonce
}

type JwtHeader = {
  alg: string
  typ: string
}

// Member Grant Functions

export type CreateMemberGrantOpts = {
  iss: string
  aud: string
  space: string
  clientId: string
}

export async function createMemberGrant(
  opts: CreateMemberGrantOpts,
  keypair: Keypair,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 300 // 5 minutes
  const jti = crypto.randomUUID()

  const payload: MemberGrantPayload = {
    iss: opts.iss,
    aud: opts.aud,
    space: opts.space,
    clientId: opts.clientId,
    lxm: 'com.atproto.space.getSpaceCredential',
    iat,
    exp,
    jti,
  }

  return createJwt('space_member_grant', payload, keypair)
}

export async function verifyMemberGrant(
  jwt: string,
  didKey: string,
): Promise<MemberGrantPayload> {
  const parsed = parseJwt(jwt)

  // Check typ
  if (parsed.header.typ !== 'space_member_grant') {
    throw new Error(`Invalid JWT type: expected space_member_grant, got ${parsed.header.typ}`)
  }

  // Verify signature
  const valid = await verifySignature(
    didKey,
    parsed.signingInput,
    parsed.signature,
    { jwtAlg: parsed.header.alg },
  )
  if (!valid) {
    throw new Error('Invalid JWT signature')
  }

  const payload = parsed.payload as MemberGrantPayload

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (now > payload.exp) {
    throw new Error('JWT token expired')
  }

  // Check lxm
  if (payload.lxm !== 'com.atproto.space.getSpaceCredential') {
    throw new Error(`Invalid lxm: expected com.atproto.space.getSpaceCredential, got ${payload.lxm}`)
  }

  return payload
}

// Space Credential Functions

export type CreateSpaceCredentialOpts = {
  iss: string
  space: string
  clientId: string
  expSeconds?: number
}

export async function createSpaceCredential(
  opts: CreateSpaceCredentialOpts,
  keypair: Keypair,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const expSeconds = opts.expSeconds ?? 7200 // 2 hours default
  const exp = iat + expSeconds
  const jti = crypto.randomUUID()

  const payload: SpaceCredentialPayload = {
    iss: opts.iss,
    space: opts.space,
    clientId: opts.clientId,
    iat,
    exp,
    jti,
  }

  return createJwt('space_credential', payload, keypair)
}

export async function verifySpaceCredential(
  jwt: string,
  didKey: string,
): Promise<SpaceCredentialPayload> {
  const parsed = parseJwt(jwt)

  // Check typ
  if (parsed.header.typ !== 'space_credential') {
    throw new Error(`Invalid JWT type: expected space_credential, got ${parsed.header.typ}`)
  }

  // Verify signature
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

  // Check expiry
  const now = Math.floor(Date.now() / 1000)
  if (now > payload.exp) {
    throw new Error('JWT token expired')
  }

  return payload
}

// Internal JWT Helpers

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
): Promise<string> {
  const header: JwtHeader = {
    alg: keypair.jwtAlg,
    typ,
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
    const headerJson = new TextDecoder().decode(fromBase64(headerB64, 'base64url'))
    header = JSON.parse(headerJson)
  } catch (err) {
    throw new Error(`Invalid JWT header: ${err}`)
  }

  let payload: Record<string, unknown>
  try {
    const payloadJson = new TextDecoder().decode(fromBase64(payloadB64, 'base64url'))
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
