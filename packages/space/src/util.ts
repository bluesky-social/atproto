import { type Cid, toBase64 } from '@atproto/lex-data'
import {
  type NsidString,
  type RecordKeyString,
  isValidNsid,
  isValidRecordKey,
} from '@atproto/syntax'
import { RepoVerificationError } from './error.js'
import type { RecordPath, RecordPathParts } from './types.js'

export function formatRecordPath<
  TCollection extends NsidString,
  TRkey extends RecordKeyString,
>(collection: TCollection, rkey: TRkey): RecordPath<TCollection, TRkey> {
  return `${collection}/${rkey}` as const
}

export function parseRecordPath(path: string): RecordPathParts {
  const { length, 0: collection, 1: rkey } = path.split('/')
  if (length !== 2) {
    throw new RepoVerificationError(`invalid record path: ${path}`)
  }
  if (!isValidNsid(collection)) {
    throw new RepoVerificationError(`invalid NSID in record path: ${path}`)
  }
  if (!isValidRecordKey(rkey)) {
    throw new RepoVerificationError(
      `invalid record key in record path: ${path}`,
    )
  }
  return { collection, rkey }
}

// The element a record contributes to a repo's set hash.
export function formatSetHashElement<
  TCollection extends NsidString,
  TRkey extends RecordKeyString,
>(
  collection: TCollection,
  rkey: TRkey,
  cid: Cid,
): `${RecordPath<TCollection, TRkey>}/${string}` {
  const path = formatRecordPath(collection, rkey)
  return `${path}/${cid.toString()}`
}

export function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// Big-endian, following the TLS convention for wire encodings.
export function uint16be(value: number): Uint8Array {
  if (value < 0 || value > 0xffff) {
    throw new Error(`value does not fit in a uint16: ${value}`)
  }
  return new Uint8Array([value >>> 8, value & 0xff])
}

// Compares in time independent of where the inputs differ, for checking MACs.
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

// Structured field byte sequences are serialized as padded base64 (RFC 9651
// §4.1.8), while `toBase64` omits padding.
export function toPaddedBase64(bytes: Uint8Array): string {
  const base64 = toBase64(bytes)
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}
