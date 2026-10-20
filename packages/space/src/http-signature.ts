import {
  isByteSequence,
  isInnerList,
  parseDictionary,
  serializeInnerList,
} from 'structured-headers'
import { type Keypair, parseDidKey, verifySignature } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { SpaceSignatureError } from './error.js'

type HttpHeaders = Record<string, string | string[] | undefined>

/**
 * Signs a `getSpaceCredential` request. The delegation token is only sent when
 * the space requires one.
 */
export type CredentialRequestSigOptions = {
  authorization?: string
  audience?: undefined
}

/** Signs a request authorized by a space credential. */
export type CredentialSigOptions = {
  authorization: string
  audience: DidString
}

export type SpaceSignatureOptions =
  CredentialRequestSigOptions | CredentialSigOptions

export type SpaceSignature = {
  signatureInput: string
  signature: Uint8Array
}

const SIGNATURE_LABEL = 'atproto-space'
const SIGNATURE_ALG = 'ecdsa-p256-sha256'
const CREDENTIAL_REQUEST_TAG = 'atproto-space-credential-request'
const CREDENTIAL_TAG = 'atproto-space-credential'

/** A covered header: its name and value. */
type Component = [name: string, value: string]

/**
 * Sign a space request. A credential request covers its delegation token (if
 * any) and names the key to bind; a credential use covers the credential and
 * its audience DID.
 */
export async function createSpaceSig(
  key: Keypair,
  { authorization, audience }: SpaceSignatureOptions,
): Promise<SpaceSignature> {
  const keyId = key.did()
  assertP256DidKey(keyId)

  const components: Component[] = []
  if (authorization !== undefined) {
    components.push(['authorization', authorization])
  }
  if (audience !== undefined) {
    components.push(['atproto-space-audience', audience])
  }

  const componentList = formatComponentList(components)
  const signatureInput =
    audience === undefined
      ? `${componentList};keyid="${keyId}";tag="${CREDENTIAL_REQUEST_TAG}"`
      : `${componentList};tag="${CREDENTIAL_TAG}"`
  return {
    signatureInput,
    signature: await key.sign(signatureBase(components, signatureInput)),
  }
}

/** Create the authorization, audience, and signature headers for a space request. */
export async function createSpaceSigHeaders(
  key: Keypair,
  opts: SpaceSignatureOptions,
): Promise<Record<string, string>> {
  const { signatureInput, signature } = await createSpaceSig(key, opts)
  return {
    ...(opts.authorization !== undefined
      ? { authorization: opts.authorization }
      : undefined),
    ...(opts.audience !== undefined
      ? { 'atproto-space-audience': opts.audience }
      : undefined),
    'signature-input': `${SIGNATURE_LABEL}=${signatureInput}`,
    signature: `${SIGNATURE_LABEL}=:${toBase64(signature)}:`,
  }
}

/**
 * Verify the signature on a `getSpaceCredential` request, returning the key it
 * names in `keyid`: the key the issued credential will be bound to.
 */
export async function verifyCredentialRequestSig(
  headers: HttpHeaders,
): Promise<DidString> {
  const components = credentialRequestComponents(headers)
  const sig = parseSpaceSig(headers, components, CREDENTIAL_REQUEST_TAG)
  const keyId = sig.params.get('keyid')
  if (typeof keyId !== 'string') {
    throw new SpaceSignatureError('signature key must be a P-256 did:key')
  }
  await verifySpaceSig(keyId, components, sig)
  return keyId as DidString
}

/**
 * Verify the signature on a request authorized by a space credential, against
 * the key the credential is bound to (its `cnf.kid`).
 */
export async function verifyCredentialSig(
  headers: HttpHeaders,
  keyId: DidString,
): Promise<void> {
  const components = credentialComponents(headers)
  const sig = parseSpaceSig(headers, components, CREDENTIAL_TAG)
  if (sig.params.has('keyid') && sig.params.get('keyid') !== keyId) {
    throw new SpaceSignatureError(
      'signature keyid does not match the credential key',
    )
  }
  await verifySpaceSig(keyId, components, sig)
}

type ParsedSpaceSig = {
  signatureInput: string
  params: Map<string, unknown>
  signature: Uint8Array
}

/** Parse the `atproto-space` signature, checking what it covers and its parameters. */
function parseSpaceSig(
  headers: HttpHeaders,
  components: Component[],
  tag: string,
): ParsedSpaceSig {
  const inputHeader = headers['signature-input']
  const signatureHeader = headers['signature']
  if (typeof inputHeader !== 'string' || typeof signatureHeader !== 'string') {
    throw new SpaceSignatureError('missing or malformed signature headers')
  }
  let input, signature
  try {
    input = parseDictionary(inputHeader).get(SIGNATURE_LABEL)
    signature = parseDictionary(signatureHeader).get(SIGNATURE_LABEL)
  } catch (cause) {
    throw new SpaceSignatureError('missing or malformed signature headers', {
      cause,
    })
  }
  if (
    !input ||
    !isInnerList(input) ||
    !signature ||
    isInnerList(signature) ||
    !isByteSequence(signature[0]) ||
    signature[1].size !== 0
  ) {
    throw new SpaceSignatureError(
      'missing or malformed atproto-space signature',
    )
  }

  const [coveredList, params] = input
  const expectedList = formatComponentList(components)
  if (serializeInnerList([coveredList, new Map()]) !== expectedList) {
    throw new SpaceSignatureError(
      `signature must cover exactly ${expectedList}, in order`,
    )
  }
  if (params.get('tag') !== tag) {
    throw new SpaceSignatureError(`signature tag must be "${tag}"`)
  }
  if (params.has('alg') && params.get('alg') !== SIGNATURE_ALG) {
    throw new SpaceSignatureError(
      `signature algorithm must be ${SIGNATURE_ALG}`,
    )
  }
  return {
    signatureInput: serializeInnerList(input),
    params,
    signature: fromBase64(signature[0].toBase64()),
  }
}

/** Verify a parsed signature over `components` against a P-256 did:key. */
async function verifySpaceSig(
  keyId: string,
  components: Component[],
  { signatureInput, signature }: ParsedSpaceSig,
): Promise<void> {
  assertP256DidKey(keyId)
  const base = signatureBase(components, signatureInput)
  const valid =
    signature.length === 64 &&
    (await verifySignature(keyId, base, signature, {
      format: 'compact',
      allowMalleableSig: true,
    }).catch(() => false))
  if (!valid) {
    throw new SpaceSignatureError('invalid HTTP message signature')
  }
}

function assertP256DidKey(keyId: string): void {
  let jwtAlg: string
  try {
    jwtAlg = parseDidKey(keyId).jwtAlg
  } catch (cause) {
    throw new SpaceSignatureError('signature key must be a P-256 did:key', {
      cause,
    })
  }
  if (jwtAlg !== 'ES256') {
    throw new SpaceSignatureError('signature key must be a P-256 did:key')
  }
}

/** A credential use covers the credential and its audience DID, both required. */
function credentialComponents(headers: HttpHeaders): Component[] {
  const authorization = headers['authorization']
  if (typeof authorization !== 'string' || !authorization) {
    throw new SpaceSignatureError('missing or malformed "authorization" field')
  }
  const audience = headers['atproto-space-audience']
  if (typeof audience !== 'string' || !audience) {
    throw new SpaceSignatureError(
      'missing or malformed "atproto-space-audience" field',
    )
  }
  return [
    ['authorization', authorization],
    ['atproto-space-audience', audience],
  ]
}

/** A credential request covers its delegation token, if it sent one. */
function credentialRequestComponents(headers: HttpHeaders): Component[] {
  const authorization = headers['authorization']
  if (authorization === undefined) {
    return []
  }
  if (typeof authorization !== 'string') {
    throw new SpaceSignatureError('malformed "authorization" field')
  }
  return [['authorization', authorization]]
}

function formatComponentList(components: Component[]): string {
  return `(${components.map(([name]) => `"${name}"`).join(' ')})`
}

function signatureBase(
  components: Component[],
  signatureInput: string,
): Uint8Array {
  const lines = components.map(([name, value]) => `"${name}": ${value.trim()}`)
  lines.push(`"@signature-params": ${signatureInput}`)
  return new TextEncoder().encode(lines.join('\n'))
}
