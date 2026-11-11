import {
  type BareItem,
  ByteSequence,
  type Dictionary,
  type InnerList,
  type Item,
  isByteSequence,
  isInnerList,
  parseDictionary,
  serializeDictionary,
  serializeInnerList,
} from 'structured-headers'
import { hmacSha256 } from '@atproto/crypto'
import { type Cid, fromBase64, ui8Equals } from '@atproto/lex-data'
import { type AtUriString, type DidString, isValidDid } from '@atproto/syntax'
import { timingSafeEqual, toPaddedBase64 } from './bytes.js'
import { SpaceMacError } from './error.js'
import {
  findSignature,
  formatComponents,
  membersWithTag,
  signatureBase,
} from './http-signature.js'
import type { Encapsulation } from './kem.js'
import type { SpaceCommit } from './types.js'

/**
 * Space repos authenticate commits and records with a MAC rather than a
 * signature, so a leaked response proves nothing to a third party. A MAC is an
 * HTTP message signature (RFC 9421) using `hmac-sha256`, keyed by a per-request
 * shared secret (see `kem.ts`).
 *
 * The syncer requests a MAC with an `Accept-Signature` header, whose `tag` names
 * a profile. The host responds with a header describing the commit or record it
 * returned, and a MAC covering that header.
 */

export const COMMIT_MAC_PROFILE = 'atproto-space-repo'
export const RECORD_MAC_PROFILE = 'atproto-space-record'

export type MacProfile = typeof COMMIT_MAC_PROFILE | typeof RECORD_MAC_PROFILE

/** The header each profile's MAC covers. */
export const MAC_COVERED_HEADER = {
  [COMMIT_MAC_PROFILE]: 'atproto-space-commit',
  [RECORD_MAC_PROFILE]: 'atproto-space-record',
} as const

const MAC_ALG = 'hmac-sha256'

// The label this syncer requests its MAC under. A host answers under the label
// that was requested, though a syncer finds the MAC by its tag.
const MAC_LABEL = 'mac'

// The parameters a host fulfills: the key share to use, the profile's tag, and
// optionally the algorithm. Each MAC is keyed by a single-use key share, so
// `created`, `expires`, and `nonce` would add nothing.
const MAC_REQUEST_PARAMS = ['keyid', 'tag', 'alg']

// A MAC covers its profile's header, flagged `sf` as a structured field.
function macComponents(profile: MacProfile): Item[] {
  return [[MAC_COVERED_HEADER[profile], new Map([['sf', true]])]]
}

// The parameters a syncer requests a MAC with.
function macParams(profile: MacProfile, keyShare: DidString): InnerList {
  return [
    macComponents(profile),
    new Map([
      ['keyid', keyShare],
      ['tag', profile],
    ]),
  ]
}

// ---- Requests ----

/**
 * The syncer's `Accept-Signature` request header, asking for a MAC keyed by the
 * shared secret for `keyShare` (see `encapsulate`), e.g.
 * `mac=("atproto-space-commit";sf);keyid="did:key:zDna...";tag="atproto-space-repo"`
 */
export function formatMacRequest(
  profile: MacProfile,
  keyShare: DidString,
): string {
  return `${MAC_LABEL}=${serializeInnerList(macParams(profile, keyShare))}`
}

/** A MAC request, as the host reads it from `Accept-Signature`. */
export type MacRequest = {
  label: string
  // The requested signature parameters, which the host's MAC uses as given.
  params: InnerList
  keyShare: DidString
}

/**
 * Find the MAC requested for `profile` in an `Accept-Signature` header, checking
 * that the host can fulfill it. Requests with other tags are ignored, so this
 * returns undefined when none is for `profile`.
 */
export function parseMacRequest(
  value: string | string[] | undefined,
  profile: MacProfile,
): MacRequest | undefined {
  if (value === undefined) return undefined
  const requests = parseMacField(value, 'Accept-Signature')
  const tagged = membersWithTag(requests, profile)
  if (tagged.length === 0) return undefined
  if (tagged.length > 1) {
    throw new SpaceMacError(`more than one MAC requested with tag "${profile}"`)
  }

  const { label, params } = tagged[0]
  const [components, parameters] = params
  const expected = formatComponents(macComponents(profile))
  if (formatComponents(components) !== expected) {
    throw new SpaceMacError(`MAC must cover exactly ${expected}`)
  }
  for (const name of parameters.keys()) {
    if (!MAC_REQUEST_PARAMS.includes(name)) {
      throw new SpaceMacError(`unsupported MAC parameter: ${name}`)
    }
  }
  if (parameters.has('alg') && parameters.get('alg') !== MAC_ALG) {
    throw new SpaceMacError(`MAC algorithm must be ${MAC_ALG}`)
  }
  const keyShare = parameters.get('keyid')
  if (!isValidDid(keyShare)) {
    throw new SpaceMacError('missing or malformed keyid')
  }
  return { label, params, keyShare }
}

// ---- Responses ----

/**
 * The response headers for a commit: an `Atproto-Space-Commit` header describing
 * it, and a MAC covering that header. The header holds the commit's fields, e.g.
 * `ver=1, repo="did:example:alice", space="at://...", rev="3mwcj3b6uak2f", data=:q3J0...=:`
 */
export function createCommitMacHeaders(
  request: MacRequest,
  sharedSecret: Uint8Array,
  commit: SpaceCommit,
): Record<string, string> {
  const header = serializeDictionary(
    new Map([
      ['ver', [commit.ver, new Map()]],
      ['repo', [commit.repo, new Map()]],
      ['space', [commit.space, new Map()]],
      ['rev', [commit.rev, new Map()]],
      ['data', [new ByteSequence(toPaddedBase64(commit.data)), new Map()]],
    ]),
  )
  return {
    [MAC_COVERED_HEADER[COMMIT_MAC_PROFILE]]: header,
    ...createMacSigHeaders(request, sharedSecret, header),
  }
}

/**
 * The response headers for a record: an `Atproto-Space-Record` header naming it,
 * and a MAC covering that header. The header holds the record's uri and cid, e.g.
 * `uri="at://...", cid="bafyrei..."`
 */
export function createRecordMacHeaders(
  request: MacRequest,
  sharedSecret: Uint8Array,
  uri: AtUriString,
  cid: Cid,
): Record<string, string> {
  const header = serializeDictionary(
    new Map([
      ['uri', [uri, new Map()]],
      ['cid', [cid.toString(), new Map()]],
    ]),
  )
  return {
    [MAC_COVERED_HEADER[RECORD_MAC_PROFILE]]: header,
    ...createMacSigHeaders(request, sharedSecret, header),
  }
}

// The `Signature-Input` and `Signature` headers for a MAC over the covered header.
function createMacSigHeaders(
  { label, params }: MacRequest,
  sharedSecret: Uint8Array,
  coveredHeader: string,
): Record<string, string> {
  const mac = hmacSha256(sharedSecret, signatureBase(params, [coveredHeader]))
  return {
    'signature-input': `${label}=${serializeInnerList(params)}`,
    signature: `${label}=:${toPaddedBase64(mac)}:`,
  }
}

// ---- Verification ----

/**
 * What a syncer checks a response's MAC with: the encapsulation the MAC was
 * requested with, and the response's headers.
 */
export type MacParams = Encapsulation & {
  headers: Headers
}

/**
 * Verify a response's MAC, and that the `Atproto-Space-Commit` header it covers
 * describes `commit`.
 */
export function verifyCommitMac(commit: SpaceCommit, mac: MacParams): void {
  const fields = verifyMac(COMMIT_MAC_PROFILE, mac)
  const data = bareItem(fields, 'data')
  const matches =
    bareItem(fields, 'ver') === commit.ver &&
    bareItem(fields, 'repo') === commit.repo &&
    bareItem(fields, 'space') === commit.space &&
    bareItem(fields, 'rev') === commit.rev &&
    data !== undefined &&
    isByteSequence(data) &&
    ui8Equals(fromBase64(data.toBase64()), commit.data)
  if (!matches) {
    throw new SpaceMacError('commit does not match its MAC')
  }
}

/**
 * Verify a response's MAC, and that the `Atproto-Space-Record` header it covers
 * names `uri` and `cid`.
 */
export function verifyRecordMac(
  uri: AtUriString,
  cid: Cid,
  mac: MacParams,
): void {
  const fields = verifyMac(RECORD_MAC_PROFILE, mac)
  if (
    bareItem(fields, 'uri') !== uri ||
    bareItem(fields, 'cid') !== cid.toString()
  ) {
    throw new SpaceMacError('record does not match its MAC')
  }
}

// Check the MAC requested for `profile`, returning the fields of the header it covers.
function verifyMac(
  profile: MacProfile,
  { keyShare, sharedSecret, headers }: MacParams,
): Dictionary {
  const { params, signature } = findSignature(
    headers.get('signature-input'),
    headers.get('signature'),
    {
      tag: profile,
      components: macComponents(profile),
      alg: MAC_ALG,
      keyId: keyShare,
    },
    SpaceMacError,
  )

  const header = MAC_COVERED_HEADER[profile]
  const fields = parseMacField(headers.get(header), header)
  // The `sf` flag covers the header as re-serialized from its parsed form.
  const base = signatureBase(params, [serializeDictionary(fields)])
  if (!timingSafeEqual(hmacSha256(sharedSecret, base), signature)) {
    throw new SpaceMacError('MAC does not match')
  }
  return fields
}

function parseMacField(
  value: string | string[] | null | undefined,
  name: string,
): Dictionary {
  if (typeof value !== 'string') {
    throw new SpaceMacError(`missing or malformed ${name} header`)
  }
  try {
    return parseDictionary(value)
  } catch (cause) {
    throw new SpaceMacError(`malformed ${name} header`, { cause })
  }
}

// A dictionary member's value, ignoring any parameters.
function bareItem(fields: Dictionary, key: string): BareItem | undefined {
  const member = fields.get(key)
  return member && !isInnerList(member) ? member[0] : undefined
}
