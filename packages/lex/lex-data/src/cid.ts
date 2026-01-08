import { CID } from 'multiformats/cid'
import {
  create as createDigest,
  equals as digestEquals,
} from 'multiformats/hashes/digest'
import { sha256, sha512 } from 'multiformats/hashes/sha2'

export const DAG_CBOR_MULTICODEC = 0x71 // DRISL conformant DAG-CBOR
export type DAG_CBOR_MULTICODEC = typeof DAG_CBOR_MULTICODEC

export const RAW_MULTICODEC = 0x55 // raw binary codec used in DASL CIDs
export type RAW_MULTICODEC = typeof RAW_MULTICODEC

export const SHA256_MULTIHASH = sha256.code
export type SHA256_MULTIHASH = typeof SHA256_MULTIHASH

export type MultihashDigest<Code extends number = number> = {
  code: Code
  digest: Uint8Array
  size: number
  bytes: Uint8Array
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
   * we update or swap out `multiformats`, we provide our own stable {@link Cid}
   * interface.
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
// importing directly from "multiformats" or"multiformats/cid").
export { CID }

/**
 * Interface for working with decoded CID string, compatible with
 * {@link CID} implementation.
 */
export interface Cid {
  version: 0 | 1
  code: number
  multihash: MultihashDigest
  bytes: Uint8Array
  equals(other: unknown): boolean
  toString(): string
}

/**
 * Represents the cid of raw binary data (like media blobs).
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats ATproto Data Model - Link and CID Formats}
 */
export interface RawCid extends Cid {
  version: 1
  code: RAW_MULTICODEC
}

export function isRawCid(cid: Cid): cid is RawCid {
  return cid.version === 1 && cid.code === RAW_MULTICODEC
}

/**
 * Represents a DASL compliant CID.
 * @see {@link https://dasl.ing/cid.html DASL-CIDs}
 */
export interface DaslCid extends Cid {
  version: 1
  code: RAW_MULTICODEC | DAG_CBOR_MULTICODEC
  multihash: MultihashDigest<SHA256_MULTIHASH>
}

export function isDaslCid(cid: Cid): cid is DaslCid {
  return (
    cid.version === 1 &&
    (cid.code === RAW_MULTICODEC || cid.code === DAG_CBOR_MULTICODEC) &&
    cid.multihash.code === SHA256_MULTIHASH &&
    cid.multihash.size === 32 // Should always be 32 bytes (256 bits) for SHA-256
  )
}

/**
 * Represents the cid of ATProto DAG-CBOR data (like repository MST nodes).
 * @see {@link https://atproto.com/specs/data-model#link-and-cid-formats ATproto Data Model - Link and CID Formats}
 */
export interface CborCid extends DaslCid {
  code: DAG_CBOR_MULTICODEC
}

export function isCborCid(cid: Cid): cid is CborCid {
  return cid.code === DAG_CBOR_MULTICODEC && isDaslCid(cid)
}

export type CidCheckOptions = {
  flavor?: 'raw' | 'cbor' | 'dasl'
}
export type InferCheckedCid<TOptions> = TOptions extends { flavor: 'raw' }
  ? RawCid
  : TOptions extends { flavor: 'cbor' }
    ? CborCid
    : Cid

/**
 * Coerces the input value to a Cid, or returns null if not possible.
 */
export function ifCid<TOptions extends CidCheckOptions>(
  value: unknown,
  options: TOptions,
): InferCheckedCid<TOptions> | null
export function ifCid(value: unknown, options?: CidCheckOptions): Cid | null
export function ifCid(value: unknown, options?: CidCheckOptions): Cid | null {
  const cid = CID.asCID(value)
  if (!cid) {
    return null
  }

  switch (options?.flavor) {
    case 'cbor':
      return isCborCid(cid) ? cid : null
    case 'raw':
      return isRawCid(cid) ? cid : null
    case 'dasl':
      return isDaslCid(cid) ? cid : null
    default:
      return cid
  }
}

export function isCid<TOptions extends CidCheckOptions>(
  value: unknown,
  options: TOptions,
): value is InferCheckedCid<TOptions>
export function isCid(value: unknown, options?: CidCheckOptions): value is Cid
export function isCid(value: unknown, options?: CidCheckOptions): value is Cid {
  return ifCid(value, options) !== null
}

/**
 * Coerces the input value to a Cid, or throws if not possible.
 */
export function asCid<TOptions extends CidCheckOptions>(
  value: unknown,
  options: TOptions,
): InferCheckedCid<TOptions>
export function asCid(value: unknown, options?: CidCheckOptions): Cid
export function asCid(value: unknown, options?: CidCheckOptions): Cid {
  const cid = ifCid(value, options)
  if (cid) return cid
  throw new Error('Not a valid CID')
}

/**
 * Parses a CID string into a Cid object.
 *
 * @throws if the input is not a valid CID string.
 */
export function parseCid<TOptions extends CidCheckOptions>(
  input: string,
  options: TOptions,
): InferCheckedCid<TOptions>
export function parseCid(input: string, options?: CidCheckOptions): Cid
export function parseCid(input: string, options?: CidCheckOptions): Cid {
  const cid = CID.parse(input)
  return asCid(cid, options)
}

/**
 * Decodes a CID from its binary representation.
 *
 * @see {@link https://dasl.ing/cid.html DASL-CIDs}
 * @throws if the input do not represent a valid DASL {@link Cid}
 */
export function decodeCid<TOptions extends CidCheckOptions>(
  cidBytes: Uint8Array,
  options: TOptions,
): InferCheckedCid<TOptions>
export function decodeCid(cidBytes: Uint8Array, options?: CidCheckOptions): Cid
export function decodeCid(
  cidBytes: Uint8Array,
  options?: CidCheckOptions,
): Cid {
  const cid = CID.decode(cidBytes)
  return asCid(cid, options)
}

export function validateCidString(
  input: string,
  options?: CidCheckOptions,
): boolean {
  return parseCidString(input, options)?.toString() === input
}

export function parseCidString<TOptions extends CidCheckOptions>(
  input: string,
  options: TOptions,
): InferCheckedCid<TOptions> | undefined
export function parseCidString(
  input: string,
  options?: CidCheckOptions,
): Cid | undefined
export function parseCidString(
  input: string,
  options?: CidCheckOptions,
): Cid | undefined {
  try {
    return parseCid(input, options)
  } catch {
    return undefined
  }
}

export function ensureValidCidString(
  input: string,
  options?: CidCheckOptions,
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
    const digest = await sha256.digest(bytes)
    return digestEquals(cid.multihash, digest)
  }

  if (cid.multihash.code === sha512.code) {
    const digest = await sha512.digest(bytes)
    return digestEquals(cid.multihash, digest)
  }

  // Don't know how to verify other multihash codes
  throw new Error('Unsupported CID multihash')
}

export async function cidForCbor(bytes: Uint8Array): Promise<CborCid> {
  const digest = await sha256.digest(bytes)
  return CID.createV1(DAG_CBOR_MULTICODEC, digest) as CborCid
}

export async function cidForRawBytes(bytes: Uint8Array): Promise<RawCid> {
  const digest = await sha256.digest(bytes)
  return CID.createV1(RAW_MULTICODEC, digest) as RawCid
}

export function cidForRawHash(hash: Uint8Array): RawCid {
  // Fool-proofing
  if (hash.length !== 32) {
    throw new Error(`Invalid SHA-256 hash length: ${hash.length}`)
  }
  const digest = createDigest(sha256.code, hash)
  return CID.createV1(RAW_MULTICODEC, digest) as RawCid
}
