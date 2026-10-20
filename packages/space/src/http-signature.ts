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

/** Signs a request authorized by a space credential. */
export type SpaceSignatureOptions = {
  authorization: string
  audience: DidString
}

export type SpaceSignature = {
  signatureInput: string
  signature: Uint8Array
}

const SIGNATURE_LABEL = 'atproto-space-credential'
const SIGNATURE_ALG = 'ecdsa-p256-sha256'
const SIGNATURE_TAG = 'atproto-space-credential'

/** A covered header: its name and value. */
type Component = [name: string, value: string]

/** Sign a request authorized by a space credential, covering the credential and its audience DID. */
export async function createSpaceSig(
  key: Keypair,
  { authorization, audience }: SpaceSignatureOptions,
): Promise<SpaceSignature> {
  assertP256DidKey(key.did())

  const components: Component[] = [
    ['authorization', authorization],
    ['atproto-space-audience', audience],
  ]
  const signatureInput = `${formatComponentList(components)};tag="${SIGNATURE_TAG}"`
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
    authorization: opts.authorization,
    'atproto-space-audience': opts.audience,
    'signature-input': `${SIGNATURE_LABEL}=${signatureInput}`,
    signature: `${SIGNATURE_LABEL}=:${toBase64(signature)}:`,
  }
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
  const sig = parseSpaceSig(headers, components)
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

/** Parse the `atproto-space-credential` signature, checking what it covers and its parameters. */
function parseSpaceSig(
  headers: HttpHeaders,
  components: Component[],
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
      `missing or malformed ${SIGNATURE_LABEL} signature`,
    )
  }

  const [coveredList, params] = input
  const expectedList = formatComponentList(components)
  if (serializeInnerList([coveredList, new Map()]) !== expectedList) {
    throw new SpaceSignatureError(
      `signature must cover exactly ${expectedList}, in order`,
    )
  }
  if (params.get('tag') !== SIGNATURE_TAG) {
    throw new SpaceSignatureError(`signature tag must be "${SIGNATURE_TAG}"`)
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

/** Whether `keyId` is a P-256 did:key, the only kind a space credential can be bound to. */
export function isP256DidKey(keyId: string): keyId is DidString {
  try {
    return parseDidKey(keyId).jwtAlg === 'ES256'
  } catch {
    return false
  }
}

function assertP256DidKey(keyId: string): void {
  if (!isP256DidKey(keyId)) {
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
