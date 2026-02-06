import { CID } from 'multiformats/cid'
import { create as createDigest } from 'multiformats/hashes/digest'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { isObject } from './object.js'
import { ui8Equals } from './uint8array.js'

/**
 * Codec code that indicates the CID references a CBOR-encoded data structure.
 *
 * Used when encoding structured data in AT Protocol repositories.
 *
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
export const CBOR_DATA_CODEC = 0x71
export type CBOR_DATA_CODEC = typeof CBOR_DATA_CODEC

/**
 * Codec code that indicates the CID references raw binary data (like media blobs).
 *
 * Used in DASL CIDs for binary blobs like images and media.
 *
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
export const RAW_DATA_CODEC = 0x55
export type RAW_DATA_CODEC = typeof RAW_DATA_CODEC

/**
 * Hash code that indicates that a CID uses SHA-256.
 */
export const SHA256_HASH_CODE = sha256.code
export type SHA256_HASH_CODE = typeof SHA256_HASH_CODE

/**
 * Hash code that indicates that a CID uses SHA-512.
 */
export const SHA512_HASH_CODE = sha512.code
export type SHA512_HASH_CODE = typeof SHA512_HASH_CODE

/**
 * Represent the hash part of a CID, which includes the hash algorithm code and
 * the raw digest bytes.
 *
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
export interface Multihash<THashCode extends number = number> {
  /**
   * Code of the hash algorithm (e.g., SHA256_HASH_CODE).
   */
  code: THashCode

  /**
   * Raw digest bytes.
   */
  digest: Uint8Array
}

/**
 * Compares two {@link Multihash} for equality.
 *
 * @param a - First {@link Multihash}
 * @param b - Second {@link Multihash}
 * @returns `true` if both multihashes have the same code and digest
 */
export function multihashEquals(a: Multihash, b: Multihash): boolean {
  if (a === b) return true
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
  TCodec extends number = number,
  THashCode extends number = number,
>(input: Cid<TVersion, TCodec, THashCode>) {
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
  return cid satisfies Cid as CID & Cid<TVersion, TCodec, THashCode>
}

/**
 * Content Identifier (CID) for addressing content by its hash.
 *
 * CIDs are self-describing content addresses used throughout AT Protocol for
 * linking to data by its cryptographic hash. This interface provides a
 * stable API that is compatible with the `multiformats` library but avoids
 * direct dependency issues.
 *
 * @typeParam TVersion - CID version (0 or 1)
 * @typeParam TCodec - Multicodec content type code
 * @typeParam THashCode - Multihash algorithm code
 *
 * @example
 * ```typescript
 * import type { Cid } from '@atproto/lex-data'
 * import { parseCid, isCid } from '@atproto/lex-data'
 *
 * // Parse a CID from a string
 * const cid: Cid = parseCid('bafyreib...')
 *
 * // Check if a value is a CID
 * if (isCid(value)) {
 *   console.log(cid.toString())
 * }
 * ```
 *
 * @see {@link isCid} to check if a value is a valid CID
 * @see {@link parseCid} to parse a CID from a string
 * @see {@link decodeCid} to decode a CID from bytes
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
export interface Cid<
  TVersion extends 0 | 1 = 0 | 1,
  TCodec extends number = number,
  THashCode extends number = number,
> {
  // @NOTE This interface is compatible with multiformats' CID implementation
  // which we are using under the hood.

  /** CID version (0 or 1). AT Protocol uses CIDv1. */
  readonly version: TVersion
  /** Coded (e.g., {@link CBOR_DATA_CODEC}, {@link RAW_DATA_CODEC}). */
  readonly code: TCodec
  /** The multihash containing the hash algorithm and digest. */
  readonly multihash: Multihash<THashCode>

  /**
   * Binary representation of the whole CID.
   */
  readonly bytes: Uint8Array

  /**
   * Compares this CID with another for equality.
   *
   * @param other - The CID to compare with
   * @returns `true` if the CIDs are equal
   */
  equals(other: Cid): boolean

  /**
   * Returns the string representation of this CID (base32 for v1, base58btc for v0).
   */
  toString(): string
}

/**
 * Represents the CID of raw binary data (like media blobs).
 *
 * The use of {@link SHA256_HASH_CODE} is recommended but not required for raw CIDs.
 *
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats AT Protocol Data Model - Link and CID Formats}
 */
export type RawCid = Cid<1, RAW_DATA_CODEC>

/**
 * Type guard to check if a CID is a raw binary CID.
 *
 * @param cid - The CID to check
 * @returns `true` if the CID is a version 1 CID with raw multicodec
 */
export function isRawCid(cid: Cid): cid is RawCid {
  return cid.version === 1 && cid.code === RAW_DATA_CODEC
}

/**
 * Represents a DASL compliant CID.
 *
 * DASL CIDs are version 1 CIDs using either raw or DAG-CBOR multicodec
 * with SHA-256 multihash.
 *
 * @see {@link https://dasl.ing/cid.html Content IDs (DASL)}
 */
export type DaslCid = Cid<1, RAW_DATA_CODEC | CBOR_DATA_CODEC, SHA256_HASH_CODE>

/**
 * Type guard to check if a CID is DASL compliant.
 *
 * @param cid - The CID to check
 * @returns `true` if the CID is DASL compliant (v1, raw/dag-cbor, sha256)
 */
export function isDaslCid(cid: Cid): cid is DaslCid {
  return (
    cid.version === 1 &&
    (cid.code === RAW_DATA_CODEC || cid.code === CBOR_DATA_CODEC) &&
    cid.multihash.code === SHA256_HASH_CODE &&
    cid.multihash.digest.byteLength === 0x20 // Should always be 32 bytes (256 bits) for SHA-256, but double-checking anyways
  )
}

/**
 * Represents the CID of AT Protocol DAG-CBOR data (like repository MST nodes).
 *
 * CBOR CIDs are version 1 CIDs using DAG-CBOR multicodec with SHA-256 multihash.
 *
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats AT Protocol Data Model - Link and CID Formats}
 */
export type CborCid = Cid<1, CBOR_DATA_CODEC, SHA256_HASH_CODE>

/**
 * Type guard to check if a CID is a DAG-CBOR CID.
 *
 * @param cid - The CID to check
 * @returns `true` if the CID is a DAG-CBOR CID (v1, dag-cbor, sha256)
 */
export function isCborCid(cid: Cid): cid is CborCid {
  return cid.code === CBOR_DATA_CODEC && isDaslCid(cid)
}

/**
 * Options for checking CID flavor constraints.
 */
export type CheckCidOptions = {
  /**
   * The CID flavor to check for.
   * - `'raw'` - Raw binary CID ({@link RawCid})
   * - `'cbor'` - DAG-CBOR CID ({@link CborCid})
   * - `'dasl'` - DASL compliant CID ({@link DaslCid})
   */
  flavor?: 'raw' | 'cbor' | 'dasl'
}

/**
 * Infers the CID type based on check options.
 *
 * @typeParam TOptions - The options used for checking
 */
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

/**
 * Validates that a string is a valid CID representation.
 *
 * Unlike {@link parseCid}, this function returns a boolean instead of throwing.
 * It also verifies that the string is the canonical representation of the CID.
 *
 * @param input - The string to validate
 * @param options - Optional flavor constraints
 * @returns `true` if the string is a valid CID
 */
export function validateCidString(
  input: string,
  options?: CheckCidOptions,
): boolean {
  return parseCidSafe(input, options)?.toString() === input
}

/**
 * Safely parses a CID string, returning `null` on failure instead of throwing.
 *
 * @param input - The string to parse
 * @param options - Optional flavor constraints
 * @returns The parsed CID, or `null` if parsing fails
 *
 * @example
 * ```typescript
 * import { parseCidSafe } from '@atproto/lex-data'
 *
 * const cid = parseCidSafe('bafyreib...')
 * if (cid) {
 *   console.log(cid.toString())
 * }
 * ```
 */
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

/**
 * Ensures that a string is a valid CID representation.
 *
 * @param input - The string to validate
 * @param options - Optional flavor constraints
 * @throws If the string is not a valid CID
 */
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

/**
 * Creates a CID from a multicodec, multihash code, and digest.
 *
 * @param code - The multicodec content type code
 * @param multihashCode - The multihash algorithm code
 * @param digest - The raw hash digest bytes
 * @returns A new CIDv1 instance
 *
 * @example
 * ```typescript
 * import { createCid, RAW_DATA_CODEC, SHA256_HASH_CODE } from '@atproto/lex-data'
 *
 * const cid = createCid(RAW_DATA_CODEC, SHA256_HASH_CODE, hashDigest)
 * ```
 */
export function createCid<TCodec extends number, THashCode extends number>(
  code: TCodec,
  multihashCode: THashCode,
  digest: Uint8Array,
) {
  const cid: Cid = CID.createV1(code, createDigest(multihashCode, digest))
  return cid as Cid<1, TCodec, THashCode>
}

/**
 * Creates a DAG-CBOR CID for the given CBOR bytes.
 *
 * Computes the SHA-256 hash of the bytes and creates a CIDv1 with DAG-CBOR multicodec.
 *
 * @param bytes - The CBOR-encoded bytes to hash
 * @returns A promise that resolves to the CborCid
 */
export async function cidForCbor(bytes: Uint8Array): Promise<CborCid> {
  const multihash = await sha256.digest(bytes)
  return CID.createV1(CBOR_DATA_CODEC, multihash) as CborCid
}

/**
 * Creates a raw CID for the given binary bytes.
 *
 * Computes the SHA-256 hash of the bytes and creates a CIDv1 with raw multicodec.
 *
 * @param bytes - The raw binary bytes to hash
 * @returns A promise that resolves to the RawCid
 */
export async function cidForRawBytes(bytes: Uint8Array): Promise<RawCid> {
  const multihash = await sha256.digest(bytes)
  return CID.createV1(RAW_DATA_CODEC, multihash) as RawCid
}

/**
 * Creates a raw CID from an existing SHA-256 hash digest.
 *
 * @param digest - The SHA-256 hash digest (must be 32 bytes)
 * @returns A RawCid with the given digest
 * @throws If the digest length is not 32 bytes
 */
export function cidForRawHash(digest: Uint8Array): RawCid {
  // Fool-proofing
  if (digest.length !== 32) {
    throw new Error(`Invalid SHA-256 hash length: ${digest.length}`)
  }
  return createCid(RAW_DATA_CODEC, sha256.code, digest)
}

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

function isUint8(val: unknown): val is number {
  return Number.isInteger(val) && (val as number) >= 0 && (val as number) < 256
}
