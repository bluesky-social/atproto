import {
  type BareItem,
  ByteSequence,
  type Dictionary,
  isByteSequence,
  isInnerList,
  parseDictionary,
  serializeDictionary,
} from 'structured-headers'
import { hmacSha256 } from '@atproto/crypto'
import { type Cid, fromBase64, ui8Concat } from '@atproto/lex-data'
import { SpaceMacError } from './error.js'
import { COMMIT_VERSION, type Commit } from './types.js'
import { timingSafeEqual, toPaddedBase64, uint16be, utf8 } from './util.js'

/**
 * Space repos authenticate commits and records with a MAC rather than a
 * signature, so a leaked response proves nothing to a third party. The MAC is
 * keyed by a per-request shared secret (see `kem.ts`) and carried in HTTP
 * headers rather than in the repo data.
 */

export const COMMIT_MAC_TYPE = 'atproto-space-repo'
export const RECORD_MAC_TYPE = 'atproto-space-record'
export const RECORD_MAC_VERSION = 1

export type MacType = typeof COMMIT_MAC_TYPE | typeof RECORD_MAC_TYPE

export const WANT_MAC_HEADER = 'atproto-space-want-mac'
export const MAC_HEADER = 'atproto-space-mac'

// The version a MAC type is currently on. Commits share theirs with the commit format.
const macVersion = (type: MacType): number =>
  type === COMMIT_MAC_TYPE ? COMMIT_VERSION : RECORD_MAC_VERSION

// ---- MACs ----

/**
 * ```
 * context = "atproto-space-repo-v1"
 *    || uint16be(len(space)) || space
 *    || uint16be(len(repo))  || repo
 *    || uint16be(len(rev))   || rev
 * mac = HMAC-SHA256(shared_secret, context || data)
 * ```
 */
export const computeCommitMac = (
  sharedSecret: Uint8Array,
  commit: Commit,
): Uint8Array => {
  const context = ui8Concat([
    utf8(`${COMMIT_MAC_TYPE}-v${COMMIT_VERSION}`),
    lengthPrefixed(commit.space),
    lengthPrefixed(commit.repo),
    lengthPrefixed(commit.rev),
  ])
  return hmacSha256(sharedSecret, ui8Concat([context, commit.data]))
}

export const verifyCommitMac = (
  sharedSecret: Uint8Array,
  commit: Commit,
  mac: Uint8Array,
): boolean => {
  return timingSafeEqual(computeCommitMac(sharedSecret, commit), mac)
}

/**
 * ```
 * context = "atproto-space-record-v1"
 *    || uint16be(len(uri)) || uri
 * mac = HMAC-SHA256(shared_secret, context || record_cid_bytes)
 * ```
 */
export const computeRecordMac = (
  sharedSecret: Uint8Array,
  uri: string,
  cid: Cid,
): Uint8Array => {
  const context = ui8Concat([
    utf8(`${RECORD_MAC_TYPE}-v${RECORD_MAC_VERSION}`),
    lengthPrefixed(uri),
  ])
  return hmacSha256(sharedSecret, ui8Concat([context, cid.bytes]))
}

export const verifyRecordMac = (
  sharedSecret: Uint8Array,
  uri: string,
  cid: Cid,
  mac: Uint8Array,
): boolean => {
  return timingSafeEqual(computeRecordMac(sharedSecret, uri, cid), mac)
}

const lengthPrefixed = (str: string): Uint8Array => {
  const bytes = utf8(str)
  return ui8Concat([uint16be(bytes.length), bytes])
}

// ---- Headers ----

/**
 * The `Atproto-Space-Want-Mac` request header, e.g.
 * `type="atproto-space-repo", ver=1, key_share="did:key:zDna..."`
 */
export const formatWantMacHeader = (
  type: MacType,
  keyShare: string,
): string => {
  return serializeDictionary(
    new Map([
      ['type', [type, new Map()]],
      ['ver', [macVersion(type), new Map()]],
      ['key_share', [keyShare, new Map()]],
    ]),
  )
}

/** Parse a request header, returning its `key_share`. */
export const parseWantMacHeader = (
  value: string | string[] | undefined,
  type: MacType,
): string => {
  const fields = parseMacDictionary(value, type)
  const keyShare = fields.get('key_share')
  if (typeof keyShare !== 'string') {
    throw new SpaceMacError('missing or malformed key_share')
  }
  return keyShare
}

/**
 * The `Atproto-Space-Mac` response header, e.g.
 * `type="atproto-space-repo", ver=1, mac=:AAECAwQF...:`
 */
export const formatMacHeader = (type: MacType, mac: Uint8Array): string => {
  return serializeDictionary(
    new Map([
      ['type', [type, new Map()]],
      ['ver', [macVersion(type), new Map()]],
      ['mac', [new ByteSequence(toPaddedBase64(mac)), new Map()]],
    ]),
  )
}

/** Parse a response header, returning its MAC. */
export const parseMacHeader = (
  value: string | string[] | undefined,
  type: MacType,
): Uint8Array => {
  const fields = parseMacDictionary(value, type)
  const mac = fields.get('mac')
  if (mac === undefined || !isByteSequence(mac)) {
    throw new SpaceMacError('missing or malformed mac')
  }
  return fromBase64(mac.toBase64())
}

// Parse either header and check its `type` and `ver`, flattening it to bare values.
const parseMacDictionary = (
  value: string | string[] | undefined,
  type: MacType,
): Map<string, BareItem> => {
  if (typeof value !== 'string') {
    throw new SpaceMacError('missing or malformed MAC header')
  }
  let dict: Dictionary
  try {
    dict = parseDictionary(value)
  } catch (cause) {
    throw new SpaceMacError('malformed MAC header', { cause })
  }

  const fields = new Map<string, BareItem>()
  for (const [key, member] of dict) {
    if (isInnerList(member)) {
      throw new SpaceMacError(`malformed MAC header field: ${key}`)
    }
    fields.set(key, member[0])
  }

  if (fields.get('type') !== type) {
    throw new SpaceMacError(`unsupported MAC type, expected ${type}`)
  }
  if (fields.get('ver') !== macVersion(type)) {
    throw new SpaceMacError(`unsupported MAC version for ${type}`)
  }
  return fields
}
