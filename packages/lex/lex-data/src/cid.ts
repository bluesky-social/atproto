import { CID } from 'multiformats/cid'

export const DAG_CBOR_MULTICODEC = 0x71
export const RAW_BIN_MULTICODEC = 0x55

export const SHA2_256_MULTIHASH_CODE = 0x12

export type MultihashDigest<Code extends number = number> = {
  code: Code
  digest: Uint8Array
  size: number
  bytes: Uint8Array
}

declare module 'multiformats/cid' {
  /**
   * @deprecated use the {@link Cid} interface from `@atproto/lex-data`, and
   * related helpers ({@link asCid}, {@link parseCid}, {@link decodeCid},
   * {@link createCid}, {@link isCid}), instead.
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

export function asCid(value: unknown): Cid | null {
  return CID.asCID(value)
}

export function parseCid(input: string): Cid {
  return CID.parse(input)
}

export function decodeCid(bytes: Uint8Array): Cid {
  return CID.decode(bytes)
}

export function createCid(code: number, digest: MultihashDigest): Cid {
  return CID.createV1(code, digest)
}

export function isCid(
  value: unknown,
  options?: { strict?: boolean },
): value is Cid {
  const cid = asCid(value)
  if (!cid) {
    return false
  }

  if (options?.strict) {
    if (cid.version !== 1) {
      return false
    }
    if (cid.code !== RAW_BIN_MULTICODEC && cid.code !== DAG_CBOR_MULTICODEC) {
      return false
    }
    if (cid.multihash.code !== SHA2_256_MULTIHASH_CODE) {
      return false
    }
  }

  return true
}

export function validateCidString(input: string): boolean {
  return parseCidString(input)?.toString() === input
}

export function parseCidString(input: string): Cid | undefined {
  try {
    return parseCid(input)
  } catch {
    return undefined
  }
}

export function ensureValidCidString(input: string): void {
  if (!validateCidString(input)) {
    throw new Error(`Invalid CID string`)
  }
}
