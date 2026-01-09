import { CID } from 'multiformats/cid'
import { create as createDigest } from 'multiformats/hashes/digest'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { isObject } from './object.js'
import { ui8Equals } from './uint8array.js'

export const DAG_CBOR_MULTICODEC = 0x71 // DRISL conformant DAG-CBOR
export type DAG_CBOR_MULTICODEC = typeof DAG_CBOR_MULTICODEC

export const RAW_MULTICODEC = 0x55 // raw binary codec used in DASL CIDs
export type RAW_MULTICODEC = typeof RAW_MULTICODEC

export const SHA256_MULTIHASH = sha256.code
export type SHA256_MULTIHASH = typeof SHA256_MULTIHASH

export const SHA512_MULTIHASH = sha512.code
export type SHA512_MULTIHASH = typeof SHA512_MULTIHASH

export interface Multihash<TCode extends number = number> {
  /**
   * Code of the multihash
   */
  code: TCode

  /**
   * Raw digest
   */
  digest: Uint8Array
}

export function multihashEquals(a: Multihash, b: Multihash): boolean {
  return a.code === b.code && ui8Equals(a.digest, b.digest)
}

declare module 'multiformats/cid' {
  /**
   * @deprecated use the {@link Cid} interface from `@atproto/lex-data`, and
   * related helpers ({@link isCid}, {@link ifCid}, {@link asCid},
   * {@link parseCid}, {@link decodeCid}), instead.
   *
   * This is marked as deprecated because we want to discourage direct usage of
   * `multiformats/cid` in dependent packages, and instead have them rely on the
   * {@link Cid} interface from `@atproto/lex-data`. The {@link CID} class from
   * `multiformats` version <10 has compatibility issues with certain TypeScript
   * configuration, which can lead to type errors in dependent packages.
   *
   * We are stuck with version 9 because `@atproto` packages did not drop
   * CommonJS support yet, and multiformats version 10 only supports ES modules.
   *
   * In order to avoid compatibility issues, while preparing for future breaking
   * changes (CID in multiformats v10+ has a slightly different interface), as
   * we update or swap out `multiformats`, `@atproto/lex-data` provides its own
   * stable {@link Cid} interface.
   */
  interface CID {}
}

// multiformats' CID class is not very portable because:
//
// - In dependent packages that use "moduleResolution" set to "node16",
//   "nodenext" or "bundler", TypeScript fails to properly resolve the
//   multiformats package when importing CID from @atproto/lex-data. This causes
//   type errors in those packages. This is caused by the fact that the
//   multiformats version <10 (which is the last version that supports CommonJS)
//   uses "exports" field in package.json, which do not contain "types"
//   entrypoints.
//   https://www.npmjs.com/package/multiformats/v/9.9.0?activeTab=code
// - By defining our own interface and helper functions, we can have more
//   control over the public API exposed by this package.
// - It allow us to have a stable interface in case we need to swap out, or
//   eventually update multiformats (should we choose to drop CommonJS support)
//   in the future.

// @NOTE Even though it is not portable, we still re-export CID here so that
// dependent packages where it can be used, have access to it (instead of
// importing directly from "multiformats" or "multiformats/cid").
export { /** @deprecated */ CID }

/**
 * Converts a {@link Cid} to a multiformats {@link CID} instance.
 *
 * @deprecated Packages depending on `@atproto/lex-data` should use the
 * {@link Cid} interface instead of relying on `multiformats`'s {@link CID}
 * implementation directly. This is to avoid compatibility issues, and in order
 * to allow better portability, compatibility and future updates.
 */
export function asMultiformatsCID<
  TVersion extends 0 | 1 = 0 | 1,
  TCode extends number = number,
  TMultihashCode extends number = number,
>(input: Cid<TVersion, TCode, TMultihashCode>) {
  const cid =
    // Already a multiformats CID instance
    CID.asCID(input) ??
    // Create a new multiformats CID instance
    CID.create(
      input.version,
      input.code,
      createDigest(input.multihash.code, input.multihash.digest),
    )

  // @NOTE: the "satisfies" operator is used here to ensure that the Cid
  // interface is indeed compatible with multiformats' CID implementation, which
  // allows us to safely rely on multiformats' CID implementation where Cid are
  // needed.
  return cid satisfies Cid as CID & Cid<TVersion, TCode, TMultihashCode>
}

/**
 * Interface for working with CIDs
 */
export interface Cid<
  TVersion extends 0 | 1 = 0 | 1,
  TCode extends number = number,
  TMultihashCode extends number = number,
> {
  // @NOTE This interface is compatible with multiformats' CID implementation
  // which we are using under the hood.

  readonly version: TVersion
  readonly code: TCode
  readonly multihash: Multihash<TMultihashCode>

  /**
   * Binary representation of the whole CID.
   */
  readonly bytes: Uint8Array

  equals(other: Cid): boolean
  toString(): string
}

/**
 * Represents the cid of raw binary data (like media blobs).
 *
 * The use of {@link SHA256_MULTIHASH} is recommended but not required for raw CIDs.
 *
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats ATproto Data Model - Link and CID Formats}
 */
export type RawCid = Cid<1, RAW_MULTICODEC>

export function isRawCid(cid: Cid): cid is RawCid {
  return cid.version === 1 && cid.code === RAW_MULTICODEC
}

/**
 * Represents a DASL compliant CID.
 * @see {@link https://dasl.ing/cid.html DASL-CIDs}
 */
export type DaslCid = Cid<
  1,
  RAW_MULTICODEC | DAG_CBOR_MULTICODEC,
  SHA256_MULTIHASH
>

export function isDaslCid(cid: Cid): cid is DaslCid {
  return (
    cid.version === 1 &&
    (cid.code === RAW_MULTICODEC || cid.code === DAG_CBOR_MULTICODEC) &&
    cid.multihash.code === SHA256_MULTIHASH &&
    cid.multihash.digest.byteLength === 32 // Should always be 32 bytes (256 bits) for SHA-256, but double-checking anyways
  )
}

/**
 * Represents the cid of ATProto DAG-CBOR data (like repository MST nodes).
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats ATproto Data Model - Link and CID Formats}
 */
export type CborCid = Cid<1, DAG_CBOR_MULTICODEC, SHA256_MULTIHASH>

export function isCborCid(cid: Cid): cid is CborCid {
  return cid.code === DAG_CBOR_MULTICODEC && isDaslCid(cid)
}

export type CheckCidOptions = {
  flavor?: 'raw' | 'cbor' | 'dasl'
}

export type InferCheckedCid<TOptions> = TOptions extends { flavor: 'raw' }
  ? RawCid
  : TOptions extends { flavor: 'cbor' }
    ? CborCid
    : Cid

/**
 * Type guard to check whether a {@link Cid} instance meets specific flavor
 * constraints.
 */
export function checkCid<TOptions extends CheckCidOptions>(
  cid: Cid,
  options: TOptions,
): cid is InferCheckedCid<TOptions>
export function checkCid(cid: Cid, options?: CheckCidOptions): boolean
export function checkCid(cid: Cid, options?: CheckCidOptions): boolean {
  switch (options?.flavor) {
    case undefined:
      return true
    case 'cbor':
      return isCborCid(cid)
    case 'dasl':
      return isDaslCid(cid)
    case 'raw':
      return isRawCid(cid)
    default:
      throw new TypeError(`Unknown CID flavor: ${options?.flavor}`)
  }
}

/**
 * Type guard to check whether a value is a valid {@link Cid} instance,
 * optionally checking for specific flavor constraints.
 */
export function isCid<TOptions extends CheckCidOptions>(
  value: unknown,
  options: TOptions,
): value is InferCheckedCid<TOptions>
export function isCid(value: unknown, options?: CheckCidOptions): value is Cid
export function isCid(value: unknown, options?: CheckCidOptions): value is Cid {
  return isCidImplementation(value) && checkCid(value, options)
}

/**
 * Returns the input value as a {@link Cid} if it is valid, or `null` otherwise.
 */
export function ifCid<TValue, TOptions extends CheckCidOptions>(
  value: unknown,
  options: TOptions,
): (TValue & InferCheckedCid<TOptions>) | null
export function ifCid<TValue>(
  value: TValue,
  options?: CheckCidOptions,
): (TValue & Cid) | null
export function ifCid(value: unknown, options?: CheckCidOptions): Cid | null {
  if (isCidImplementation(value) && checkCid(value, options)) return value
  return null
}

/**
 * Returns the input value as a {@link Cid} if it is valid.
 *
 * @throws if the input is not a valid {@link Cid}.
 */
export function asCid<TValue, TOptions extends CheckCidOptions>(
  value: TValue,
  options: TOptions,
): TValue & InferCheckedCid<TOptions>
export function asCid<TValue>(
  value: TValue,
  options?: CheckCidOptions,
): Cid & TValue
export function asCid(value: unknown, options?: CheckCidOptions): Cid {
  if (isCidImplementation(value) && checkCid(value, options)) return value
  throw new Error('Not a valid CID')
}

/**
 * Decodes a CID from its binary representation.
 *
 * @see {@link https://dasl.ing/cid.html DASL-CIDs}
 * @throws if the input do not represent a valid DASL {@link Cid}
 */
export function decodeCid<TOptions extends CheckCidOptions>(
  cidBytes: Uint8Array,
  options: TOptions,
): InferCheckedCid<TOptions>
export function decodeCid(cidBytes: Uint8Array, options?: CheckCidOptions): Cid
export function decodeCid(
  cidBytes: Uint8Array,
  options?: CheckCidOptions,
): Cid {
  const cid = CID.decode(cidBytes)
  return asCid(cid, options)
}

/**
 * Parses a CID string into a Cid object.
 *
 * @throws if the input is not a valid CID string.
 */
export function parseCid<TOptions extends CheckCidOptions>(
  input: string,
  options: TOptions,
): InferCheckedCid<TOptions>
export function parseCid(input: string, options?: CheckCidOptions): Cid
export function parseCid(input: string, options?: CheckCidOptions): Cid {
  const cid = CID.parse(input)
  return asCid(cid, options)
}

export function validateCidString(
  input: string,
  options?: CheckCidOptions,
): boolean {
  return parseCidSafe(input, options)?.toString() === input
}

export function parseCidSafe<TOptions extends CheckCidOptions>(
  input: string,
  options: TOptions,
): InferCheckedCid<TOptions> | null
export function parseCidSafe(
  input: string,
  options?: CheckCidOptions,
): Cid | null
export function parseCidSafe(
  input: string,
  options?: CheckCidOptions,
): Cid | null {
  try {
    return parseCid(input, options)
  } catch {
    return null
  }
}

export function ensureValidCidString(
  input: string,
  options?: CheckCidOptions,
): void {
  if (!validateCidString(input, options)) {
    throw new Error(`Invalid CID string`)
  }
}

/**
 * Verifies whether the multihash of a given {@link cid} matches the hash of the provided {@link bytes}.
 * @params cid The CID to match against the bytes.
 * @params bytes The bytes to verify.
 * @returns true if the CID matches the bytes, false otherwise.
 */
export async function isCidForBytes(
  cid: Cid,
  bytes: Uint8Array,
): Promise<boolean> {
  if (cid.multihash.code === sha256.code) {
    const multihash = await sha256.digest(bytes)
    return multihashEquals(multihash, cid.multihash)
  }

  if (cid.multihash.code === sha512.code) {
    const multihash = await sha512.digest(bytes)
    return multihashEquals(multihash, cid.multihash)
  }

  // Don't know how to verify other multihash codes
  throw new Error('Unsupported CID multihash')
}

export function createCid<TCode extends number, TMultihashCode extends number>(
  code: TCode,
  multihashCode: TMultihashCode,
  digest: Uint8Array,
) {
  const cid: Cid = CID.createV1(code, createDigest(multihashCode, digest))
  return cid as Cid<1, TCode, TMultihashCode>
}

export async function cidForCbor(bytes: Uint8Array): Promise<CborCid> {
  const multihash = await sha256.digest(bytes)
  return CID.createV1(DAG_CBOR_MULTICODEC, multihash) as CborCid
}

export async function cidForRawBytes(bytes: Uint8Array): Promise<RawCid> {
  const multihash = await sha256.digest(bytes)
  return CID.createV1(RAW_MULTICODEC, multihash) as RawCid
}

export function cidForRawHash(digest: Uint8Array): RawCid {
  // Fool-proofing
  if (digest.length !== 32) {
    throw new Error(`Invalid SHA-256 hash length: ${digest.length}`)
  }
  return createCid(RAW_MULTICODEC, sha256.code, digest)
}

/**
 * @internal
 */
function isCidImplementation(value: unknown): value is Cid {
  if (CID.asCID(value)) {
    // CIDs created using older multiformats versions did not have a "bytes"
    // property.
    return (value as { bytes?: Uint8Array }).bytes != null
  } else {
    // Unknown implementation, do a structural check
    try {
      if (!isObject(value)) return false

      const val = value as Record<string, unknown>
      if (val.version !== 0 && val.version !== 1) return false
      if (!isUint8(val.code)) return false

      if (!isObject(val.multihash)) return false
      const mh = val.multihash as Record<string, unknown>
      if (!isUint8(mh.code)) return false
      if (!(mh.digest instanceof Uint8Array)) return false

      // Ensure that the bytes array is consistent with other properties
      if (!(val.bytes instanceof Uint8Array)) return false
      if (val.bytes[0] !== val.version) return false
      if (val.bytes[1] !== val.code) return false
      if (val.bytes[2] !== mh.code) return false
      if (val.bytes[3] !== mh.digest.length) return false
      if (val.bytes.length !== 4 + mh.digest.length) return false
      if (!ui8Equals(val.bytes.subarray(4), mh.digest)) return false

      if (typeof val.equals !== 'function') return false
      if (val.equals(val) !== true) return false

      return true
    } catch {
      return false
    }
  }
}

/**
 * @internal
 */
function isUint8(val: unknown): val is number {
  return Number.isInteger(val) && (val as number) >= 0 && (val as number) < 256
}
