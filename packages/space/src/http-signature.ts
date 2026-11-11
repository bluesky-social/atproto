import {
  type Dictionary,
  type InnerList,
  type Item,
  isByteSequence,
  isInnerList,
  parseDictionary,
  serializeInnerList,
  serializeItem,
} from 'structured-headers'
import { type Keypair, parseDidKey, verifySignature } from '@atproto/crypto'
import { fromBase64 } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { toPaddedBase64, utf8 } from './bytes.js'
import { SpaceSignatureError } from './error.js'

type HttpHeaders = Record<string, string | string[] | undefined>

/** Signs a request authorized by a space credential. */
export type SpaceSignatureOptions = {
  authorization: string
  audience: DidString
  keypair: Keypair
}

export type SpaceSignature = {
  signatureInput: string
  signature: Uint8Array
}

const SIGNATURE_LABEL = 'sig'
const SIGNATURE_ALG = 'ecdsa-p256-sha256'
const SIGNATURE_TAG = 'atproto-space-credential'

// A credential use covers the credential and its audience DID, in that order.
const CREDENTIAL_COMPONENTS: Item[] = [
  ['authorization', new Map()],
  ['atproto-space-audience', new Map()],
]

/** Sign a request authorized by a space credential, covering the credential and its audience DID. */
export async function createSpaceSig({
  authorization,
  audience,
  keypair,
}: SpaceSignatureOptions): Promise<SpaceSignature> {
  assertP256DidKey(keypair.did())

  const params: InnerList = [
    CREDENTIAL_COMPONENTS,
    new Map([['tag', SIGNATURE_TAG]]),
  ]
  const base = signatureBase(params, [authorization, audience])
  return {
    signatureInput: serializeInnerList(params),
    signature: await keypair.sign(base),
  }
}

/** Create the authorization, audience, and signature headers for a space request. */
export async function createSpaceSigHeaders(
  opts: SpaceSignatureOptions,
): Promise<{ headers: Record<string, string> }> {
  const { signatureInput, signature } = await createSpaceSig(opts)
  return {
    headers: {
      authorization: opts.authorization,
      'atproto-space-audience': opts.audience,
      'signature-input': `${SIGNATURE_LABEL}=${signatureInput}`,
      signature: `${SIGNATURE_LABEL}=:${toPaddedBase64(signature)}:`,
    },
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
  const values = credentialValues(headers)
  const { params, signature } = findSignature(
    headers['signature-input'],
    headers['signature'],
    {
      tag: SIGNATURE_TAG,
      components: CREDENTIAL_COMPONENTS,
      alg: SIGNATURE_ALG,
      keyId,
    },
    SpaceSignatureError,
  )
  assertP256DidKey(keyId)

  const base = signatureBase(params, values)
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

/** The values a credential use covers, both required. */
function credentialValues(headers: HttpHeaders): string[] {
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
  return [authorization, audience]
}

// ---- RFC 9421 helpers, shared with MACs (see `mac.ts`) ----

/** What an application requires of the signature it verifies (RFC 9421 §3.2.1). */
export type SignatureRequirements = {
  // Identifies the signature among any others on the message.
  tag: string
  // Exactly the components it must cover, in order.
  components: Item[]
  // The algorithm and key it must use, if its `alg` and `keyid` name them.
  alg: string
  keyId: string
}

/**
 * Find the one signature tagged `tag` in a message's `Signature-Input` and
 * `Signature` fields, and check it meets the application's requirements. Labels
 * carry no meaning (RFC 9421 §7.2.5), so the tag is what identifies it. Other
 * parameters, like `created`, are covered by the signature but not interpreted.
 */
export function findSignature(
  inputField: string | string[] | null | undefined,
  signatureField: string | string[] | null | undefined,
  required: SignatureRequirements,
  SignatureError: new (message: string, options?: ErrorOptions) => Error,
): { params: InnerList; signature: Uint8Array } {
  if (typeof inputField !== 'string' || typeof signatureField !== 'string') {
    throw new SignatureError('missing or malformed signature headers')
  }
  let inputs: Dictionary, signatures: Dictionary
  try {
    inputs = parseDictionary(inputField)
    signatures = parseDictionary(signatureField)
  } catch (cause) {
    throw new SignatureError('missing or malformed signature headers', {
      cause,
    })
  }

  const { tag } = required
  const tagged = membersWithTag(inputs, tag)
  if (tagged.length > 1) {
    throw new SignatureError(`more than one signature with tag "${tag}"`)
  }
  const signature = tagged[0] && getSignature(signatures, tagged[0].label)
  if (!signature) {
    throw new SignatureError(`missing or malformed signature with tag "${tag}"`)
  }

  const { params } = tagged[0]
  const [components, parameters] = params
  const expected = formatComponents(required.components)
  if (formatComponents(components) !== expected) {
    throw new SignatureError(
      `signature must cover exactly ${expected}, in order`,
    )
  }
  if (parameters.has('alg') && parameters.get('alg') !== required.alg) {
    throw new SignatureError(`signature algorithm must be ${required.alg}`)
  }
  if (parameters.has('keyid') && parameters.get('keyid') !== required.keyId) {
    throw new SignatureError('signature keyid does not match the expected key')
  }
  return { params, signature }
}

/** The members of a `Signature-Input` or `Accept-Signature` field tagged `tag`. */
export function membersWithTag(
  members: Dictionary,
  tag: string,
): { label: string; params: InnerList }[] {
  const tagged: { label: string; params: InnerList }[] = []
  for (const [label, member] of members) {
    if (isInnerList(member) && member[1].get('tag') === tag) {
      tagged.push({ label, params: member })
    }
  }
  return tagged
}

// The signature bytes under `label` in a `Signature` field, if well formed.
function getSignature(
  signatures: Dictionary,
  label: string,
): Uint8Array | undefined {
  const member = signatures.get(label)
  if (
    !member ||
    isInnerList(member) ||
    !isByteSequence(member[0]) ||
    member[1].size !== 0
  ) {
    return undefined
  }
  return fromBase64(member[0].toBase64())
}

/** A covered component list without its parameters, e.g. `("authorization" "atproto-space-audience")`. */
export function formatComponents(components: Item[]): string {
  return serializeInnerList([components, new Map()])
}

/**
 * The signature base (RFC 9421 §2.5) for a signature with parameters `params`.
 * `values` holds the value of each covered component, in order.
 */
export function signatureBase(params: InnerList, values: string[]): Uint8Array {
  const lines = params[0].map(
    (component, i) => `${serializeItem(component)}: ${values[i].trim()}`,
  )
  lines.push(`"@signature-params": ${serializeInnerList(params)}`)
  return utf8(lines.join('\n'))
}
