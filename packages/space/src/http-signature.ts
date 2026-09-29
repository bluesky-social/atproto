import {
  isByteSequence,
  isInnerList,
  parseDictionary,
  serializeInnerList,
  serializeList,
} from 'structured-headers'
import { type Keypair, parseDidKey, verifySignature } from '@atproto/crypto'
import { fromBase64, toBase64 } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { SpaceSignatureError } from './error.js'

type HttpHeaders = Record<string, string | string[] | undefined>

export type SpaceSignatureOptions = {
  authorization: string
  audience?: DidString
}

export type SpaceSignature = {
  signatureInput: string
  signature: Uint8Array
}

const SIGNATURE_LABEL = 'atproto-space'
const SIGNATURE_ALG = 'ecdsa-p256-sha256'

/** Sign the authorization token and, when using a credential, its audience DID. */
export async function createSpaceSig(
  key: Keypair,
  { authorization, audience }: SpaceSignatureOptions,
): Promise<SpaceSignature> {
  const keyId = key.did()
  if (parseDidKey(keyId).jwtAlg !== 'ES256') {
    throw new SpaceSignatureError('signature key must be a P-256 did:key')
  }

  const coveredHeaders =
    audience === undefined
      ? '("authorization")'
      : '("authorization" "atproto-space-audience")'
  const signatureInput = `${coveredHeaders};keyid="${keyId}";alg="${SIGNATURE_ALG}"`
  return {
    signatureInput,
    signature: await key.sign(
      signatureBase(authorization, signatureInput, audience),
    ),
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
    ...(opts.audience !== undefined
      ? { 'atproto-space-audience': opts.audience }
      : undefined),
    'signature-input': `${SIGNATURE_LABEL}=${signatureInput}`,
    signature: `${SIGNATURE_LABEL}=:${toBase64(signature)}:`,
  }
}

/** Verify a spaces signature from normalized HTTP headers. */
export async function verifySpaceSignature(
  headers: HttpHeaders,
  keyId?: DidString,
): Promise<DidString> {
  try {
    const inputHeader = headers['signature-input']
    const signatureHeader = headers['signature']
    if (
      typeof inputHeader !== 'string' ||
      typeof signatureHeader !== 'string'
    ) {
      throw new SpaceSignatureError('missing or malformed signature headers')
    }
    const input = parseDictionary(inputHeader).get(SIGNATURE_LABEL)
    const signature = parseDictionary(signatureHeader).get(SIGNATURE_LABEL)
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

    const [components, params] = input
    const expectedHeaders =
      keyId === undefined
        ? '"authorization"'
        : '"authorization", "atproto-space-audience"'
    if (serializeList(components) !== expectedHeaders) {
      throw new SpaceSignatureError(
        `signature must cover exactly ${expectedHeaders}, in order`,
      )
    }
    if (params.size !== 2) {
      throw new SpaceSignatureError(
        'signature requires only keyid and alg parameters',
      )
    }
    if (params.get('alg') !== SIGNATURE_ALG) {
      throw new SpaceSignatureError(
        `signature algorithm must be ${SIGNATURE_ALG}`,
      )
    }
    const signingKey = params.get('keyid')
    if (typeof signingKey !== 'string') {
      throw new SpaceSignatureError('signature key must be a P-256 did:key')
    }
    if (parseDidKey(signingKey).jwtAlg !== 'ES256') {
      throw new SpaceSignatureError('signature key must be a P-256 did:key')
    }
    if (keyId !== undefined && signingKey !== keyId) {
      throw new SpaceSignatureError(
        'signature is not signed by the key the credential is bound to',
      )
    }

    const authorization = headers['authorization']
    if (typeof authorization !== 'string' || !authorization) {
      throw new SpaceSignatureError(
        'request requires exactly one "authorization" field',
      )
    }
    let audience: string | undefined
    if (keyId !== undefined) {
      const value = headers['atproto-space-audience']
      if (typeof value !== 'string' || !value) {
        throw new SpaceSignatureError(
          'request requires exactly one "atproto-space-audience" field',
        )
      }
      audience = value
    }

    const base = signatureBase(
      authorization,
      serializeInnerList(input),
      audience,
    )
    const bytes = fromBase64(signature[0].toBase64())
    if (
      bytes.length !== 64 ||
      !(await verifySignature(signingKey, base, bytes, {
        format: 'compact',
        allowMalleableSig: true,
      }))
    ) {
      throw new SpaceSignatureError('invalid HTTP message signature')
    }
    return signingKey as DidString
  } catch (cause) {
    if (cause instanceof SpaceSignatureError) throw cause
    throw new SpaceSignatureError('invalid HTTP message signature', { cause })
  }
}

function signatureBase(
  authorization: string,
  signatureInput: string,
  audience?: string,
): Uint8Array {
  const lines = [`"authorization": ${authorization.trim()}`]
  if (audience !== undefined) {
    lines.push(`"atproto-space-audience": ${audience.trim()}`)
  }
  lines.push(`"@signature-params": ${signatureInput}`)
  return new TextEncoder().encode(lines.join('\n'))
}
