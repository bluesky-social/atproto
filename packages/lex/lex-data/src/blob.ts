import { Cid, RawCid, ifCid, parseCid, validateCidString } from './cid.js'
import { LexValue } from './lex.js'
import { isPlainObject, isPlainProto } from './object.js'

// Number.isSafeInteger is actually safe to use with non-number values, so we
// can use it as a type guard.
const isSafeInteger = Number.isSafeInteger as (v: unknown) => v is number

/**
 * Reference to binary data (like images, videos, etc.) in the AT Protocol data model.
 *
 * A BlobRef is a {@link LexMap} with a specific structure that identifies binary
 * content by its content hash (CID), along with metadata about the content type
 * and size.
 *
 * @typeParam Ref - The type of CID reference, defaults to any {@link Cid}
 *
 * @example
 * ```typescript
 * import type { BlobRef } from '@atproto/lex-data'
 *
 * const imageRef: BlobRef = {
 *   $type: 'blob',
 *   mimeType: 'image/jpeg',
 *   ref: cid,  // CID of the blob content
 *   size: 12345
 * }
 * ```
 *
 * @see {@link isBlobRef} to check if a value is a valid BlobRef
 * @see {@link LegacyBlobRef} for the older blob reference format
 */
export type BlobRef<Ref extends Cid = Cid> = {
  $type: 'blob'
  mimeType: string
  ref: Ref
  size: number
}

/**
 * Options for validating a {@link BlobRef}.
 */
export type BlobRefCheckOptions = {
  /**
   * If `false`, skips strict CID validation of {@link BlobRef.ref}, allowing
   * any valid CID. Otherwise, validates that the CID is v1, uses the raw
   * multicodec, and has a sha256 multihash.
   *
   * @default true
   */
  strict?: boolean
}

/**
 * Infers the BlobRef type based on the check options.
 *
 * @typeParam TOptions - The options used for checking
 */
export type InferCheckedBlobRef<TOptions extends BlobRefCheckOptions> =
  TOptions extends { strict: false }
    ? BlobRef
    : { strict: boolean } extends TOptions
      ? BlobRef
      : BlobRef<RawCid>

/**
 * Error thrown when a value is not a valid {@link BlobRef}.
 */
export class InvalidBlobRefError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidBlobRefError'
  }
}

/**
 * Type guard to check if a value is a valid {@link BlobRef}.
 *
 * Validates the structure of the input including:
 * - `$type` must be `'blob'`
 * - `mimeType` must be a valid MIME type string (containing '/')
 * - `size` must be a non-negative safe integer
 * - `ref` must be a valid CID (strict validation by default)
 *
 * @param input - The value to check
 * @param options - Optional validation options
 * @returns `true` if the input is a valid BlobRef
 *
 * @example
 * ```typescript
 * import { isBlobRef } from '@atproto/lex-data'
 *
 * if (isBlobRef(data)) {
 *   console.log(data.mimeType)  // e.g., 'image/jpeg'
 *   console.log(data.size)      // e.g., 12345
 * }
 *
 * // Allow any valid CID (not just raw CIDs)
 * if (isBlobRef(data, { strict: false })) {
 *   // ...
 * }
 * ```
 */
export function isBlobRef(input: unknown): input is BlobRef<RawCid>
export function isBlobRef<TOptions extends BlobRefCheckOptions>(
  input: unknown,
  options: TOptions,
): input is InferCheckedBlobRef<TOptions>
export function isBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): input is BlobRef
export function isBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): input is BlobRef {
  if (!isPlainObject(input)) {
    return false
  }

  if (input?.$type !== 'blob') {
    return false
  }

  const { mimeType, size, ref } = input
  // @NOTE Very basic mime validation
  if (typeof mimeType !== 'string' || !mimeType.includes('/')) {
    return false
  }

  if (size === -1 && options?.strict === false) {
    // In non-strict mode, allow size to be -1 to accommodate legacy blob refs
    // that don't include size information.
  } else if (!isSafeInteger(size) || size < 0) {
    return false
  }

  if (typeof ref !== 'object' || ref === null) {
    return false
  }

  for (const key in input) {
    if (
      key !== '$type' &&
      key !== 'mimeType' &&
      key !== 'ref' &&
      key !== 'size'
    ) {
      return false
    }
  }

  const cid = ifCid(
    ref,
    // Strict unless explicitly disabled
    options?.strict === false ? undefined : { flavor: 'raw' },
  )
  if (!cid) {
    return false
  }

  return true
}

/**
 * Asserts that a value is a valid {@link BlobRef}, throwing an error if it is not.
 *
 * @throws {@link InvalidBlobRefError} if the input is not a valid BlobRef
 *
 * @example
 * ```typescript
 * import { assertBlobRef } from '@atproto/lex-data'
 *
 * assertBlobRef(data)
 * // TypeScript now knows data is a BlobRef
 * console.log(data.mimeType)
 * ```
 */
export function assertBlobRef(input: unknown): asserts input is BlobRef<RawCid>
export function assertBlobRef<TOptions extends BlobRefCheckOptions>(
  input: unknown,
  options: TOptions,
): asserts input is InferCheckedBlobRef<TOptions>
export function assertBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): asserts input is BlobRef
export function assertBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): asserts input is BlobRef {
  if (!isBlobRef(input, options)) {
    throw new InvalidBlobRefError('Value is not a valid BlobRef')
  }
}

/**
 * Casts a value to a {@link BlobRef} if it is valid, throwing an error if it is not.
 *
 * @throws {@link InvalidBlobRefError} if the input is not a valid BlobRef
 *
 * @example
 * ```typescript
 * import { asBlobRef } from '@atproto/lex-data'
 *
 * const blobRef = asBlobRef(data)
 * console.log(blobRef.mimeType)
 * ```
 */
export function asBlobRef(input: unknown): BlobRef<RawCid>
export function asBlobRef<TOptions extends BlobRefCheckOptions>(
  input: unknown,
  options: TOptions,
): InferCheckedBlobRef<TOptions>
export function asBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): BlobRef
export function asBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): BlobRef {
  assertBlobRef(input, options)
  return input
}

/**
 * Returns the input if it is a valid {@link BlobRef}, or `undefined` if it is not.
 *
 * @returns The input as a BlobRef, or undefined
 *
 * @example
 * ```typescript
 * import { ifBlobRef } from '@atproto/lex-data'
 *
 * const blobRef = ifBlobRef(data)
 * if (blobRef) {
 *   console.log(blobRef.mimeType)
 * }
 * ```
 */
export function ifBlobRef(input: unknown): BlobRef<RawCid> | undefined
export function ifBlobRef<TOptions extends BlobRefCheckOptions>(
  input: unknown,
  options: TOptions,
): InferCheckedBlobRef<TOptions> | undefined
export function ifBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): BlobRef | undefined
export function ifBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): BlobRef | undefined {
  return isBlobRef(input, options) ? input : undefined
}

/**
 * Legacy format for blob references used in older AT Protocol data.
 *
 * This is the older format that stores the CID as a string rather than
 * as a structured CID object. New code should use {@link BlobRef} instead.
 *
 * @example
 * ```typescript
 * import type { LegacyBlobRef } from '@atproto/lex-data'
 *
 * const legacyRef: LegacyBlobRef = {
 *   cid: 'bafyreib...',
 *   mimeType: 'image/jpeg'
 * }
 * ```
 *
 * @see {@link isLegacyBlobRef} to check if a value is a LegacyBlobRef
 * @see {@link BlobRef} for the current blob reference format
 * @deprecated Use {@link BlobRef} for new code
 */
export type LegacyBlobRef = {
  cid: string
  mimeType: string
}

/**
 * Error thrown when a value is not a valid {@link LegacyBlobRef}.
 */
export class InvalidLegacyBlobRefError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidLegacyBlobRefError'
  }
}

/**
 * Type guard to check if a value is a valid {@link LegacyBlobRef}.
 *
 * Validates the structure of the input:
 * - `cid` must be a valid CID string
 * - `mimeType` must be a non-empty string
 * - No additional properties allowed
 *
 * @example
 * ```typescript
 * import { isLegacyBlobRef } from '@atproto/lex-data'
 *
 * if (isLegacyBlobRef(data)) {
 *   console.log(data.cid)       // CID as string
 *   console.log(data.mimeType)  // e.g., 'image/jpeg'
 * }
 * ```
 *
 * @see {@link isBlobRef} for checking the current blob reference format
 */
export function isLegacyBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): input is LegacyBlobRef {
  if (!isPlainObject(input)) {
    return false
  }

  const { cid, mimeType } = input
  if (typeof cid !== 'string') {
    return false
  }

  if (typeof mimeType !== 'string' || mimeType.length === 0) {
    return false
  }

  for (const key in input) {
    if (key !== 'cid' && key !== 'mimeType') {
      return false
    }
  }

  if (
    !validateCidString(
      cid,
      options?.strict === false ? undefined : { flavor: 'raw' },
    )
  ) {
    return false
  }

  return true
}

/**
 * Asserts that a value is a valid {@link LegacyBlobRef}, throwing an error if it is not.
 *
 * @throws {@link InvalidLegacyBlobRefError} if the input is not a valid LegacyBlobRef
 *
 * @example
 * ```typescript
 * import { assertLegacyBlobRef } from '@atproto/lex-data'
 *
 * assertLegacyBlobRef(data)
 * // TypeScript now knows data is a LegacyBlobRef
 * console.log(data.cid)
 * ```
 */
export function assertLegacyBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): asserts input is LegacyBlobRef {
  if (!isLegacyBlobRef(input, options)) {
    throw new InvalidLegacyBlobRefError('Value is not a valid LegacyBlobRef')
  }
}

/**
 * Casts a value to a {@link LegacyBlobRef} if it is valid, throwing an error if it is not.
 *
 * @throws {@link InvalidLegacyBlobRefError} if the input is not a valid LegacyBlobRef
 *
 * @example
 * ```typescript
 * import { asLegacyBlobRef } from '@atproto/lex-data'
 *
 * const legacyBlobRef = asLegacyBlobRef(data)
 * console.log(legacyBlobRef.cid)
 * ```
 */
export function asLegacyBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): LegacyBlobRef {
  assertLegacyBlobRef(input, options)
  return input
}

/**
 * Returns the input if it is a valid {@link LegacyBlobRef}, or `undefined` if it is not.
 *
 * @returns The input as a LegacyBlobRef, or undefined
 *
 * @example
 * ```typescript
 * import { ifLegacyBlobRef } from '@atproto/lex-data'
 *
 * const legacyBlobRef = ifLegacyBlobRef(data)
 * if (legacyBlobRef) {
 *   console.log(legacyBlobRef.cid)
 * }
 * ```
 */
export function ifLegacyBlobRef(
  input: unknown,
  options?: BlobRefCheckOptions,
): LegacyBlobRef | undefined {
  return isLegacyBlobRef(input, options) ? input : undefined
}

/**
 * Extracts the MIME type from a {@link BlobRef} or {@link LegacyBlobRef}.
 *
 * @example
 * ```ts
 * const mimeType = getBlobMime(blobRef)
 * console.log(mimeType)  // e.g., 'image/jpeg'
 * ```
 */
export function getBlobMime(blob: BlobRef | LegacyBlobRef): string
export function getBlobMime(blob?: BlobRef | LegacyBlobRef): string | undefined
export function getBlobMime(
  blob?: BlobRef | LegacyBlobRef,
): string | undefined {
  return blob?.mimeType
}

/**
 * Extracts the size (in bytes) from a {@link BlobRef}. For
 * {@link LegacyBlobRef}, size information is not available, so this function
 * returns `undefined` for legacy refs.
 *
 * @note The size property, in blob refs, cannot be 100% trusted since the PDS
 * might not have a local copy of the blob (to check the size against) and might
 * just be passing through the blob ref from the client without validating it.
 * So, while this function can be useful for getting size information when
 * available, it should not be solely relied upon for critical functionality
 * without additional validation.
 *
 * @example
 * ```ts
 * const size = getBlobSize(blobRef)
 * if (size !== undefined) {
 *   console.log(`Blob size: ${size} bytes`)
 * } else {
 *   console.log('Size information not available for legacy blob ref')
 * }
 * ```
 */
export function getBlobSize(blob: BlobRef | LegacyBlobRef): number | undefined {
  if ('$type' in blob && blob.size >= 0) return blob.size
  // LegacyBlobRef doesn't have size information
  return undefined
}

/**
 * Extracts the {@link Cid} from a {@link BlobRef} or {@link LegacyBlobRef}.
 *
 * @throws If the input input is a {@link LegacyBlobRef} with an invalid CID string
 * @example
 * ```ts
 * const cid = getBlobCid(blobRef)
 * console.log(cid.bytes)
 * ```
 */
export function getBlobCid(blob: BlobRef | LegacyBlobRef): Cid
export function getBlobCid(blob?: BlobRef | LegacyBlobRef): Cid | undefined
export function getBlobCid(blob?: BlobRef | LegacyBlobRef): Cid | undefined {
  if (!blob) return undefined
  return '$type' in blob ? blob.ref : parseCid(blob.cid)
}

/**
 * Extracts the CID string from a {@link BlobRef} or {@link LegacyBlobRef}.
 *
 * This is similar to `getBlobCid(blob).toString()` but is more optimized since
 * the CID string is already available in the legacy format and we can avoid
 * parsing it into a CID object just to convert it back to a string.
 *
 * @example
 * ```ts
 * const cidString = getBlobCidString(blobRef)
 * console.log(cidString)
 * ```
 */
export function getBlobCidString(blob: BlobRef | LegacyBlobRef): string
export function getBlobCidString(
  blob?: BlobRef | LegacyBlobRef,
): string | undefined
export function getBlobCidString(
  blob?: BlobRef | LegacyBlobRef,
): string | undefined {
  if (!blob) return undefined
  return '$type' in blob ? blob.ref.toString() : blob.cid
}

/**
 * Options for enumerating blob references within a {@link LexValue}.
 */
export type EnumBlobRefsOptions = BlobRefCheckOptions & {
  /**
   * If `true`, also yields {@link LegacyBlobRef} objects in addition to
   * {@link BlobRef} objects.
   *
   * @default false
   */
  allowLegacy?: boolean
}

/**
 * Infers the yielded type of {@link enumBlobRefs} based on options.
 *
 * @typeParam TOptions - The options used for enumeration
 */
export type InferEnumBlobRefs<TOptions extends EnumBlobRefsOptions> =
  TOptions extends { allowLegacy: true }
    ? InferCheckedBlobRef<TOptions> | LegacyBlobRef
    : { allowLegacy: boolean } extends TOptions
      ? InferCheckedBlobRef<TOptions> | LegacyBlobRef
      : InferCheckedBlobRef<TOptions>

/**
 * Generator that enumerates all {@link BlobRef}s (and, optionally,
 * {@link LegacyBlobRef}s) found within a {@link LexValue}.
 *
 * Performs a deep traversal of the input value, yielding any blob references
 * found. This is useful for extracting all media references from a record.
 *
 * @param input - The LexValue to search for blob references
 * @param options - Optional configuration for the enumeration
 * @yields Each blob reference found in the input
 *
 * @example
 * ```typescript
 * import { enumBlobRefs } from '@atproto/lex-data'
 *
 * const record = {
 *   text: 'Hello',
 *   images: [
 *     { $type: 'blob', mimeType: 'image/jpeg', ref: cid1, size: 1000 },
 *     { $type: 'blob', mimeType: 'image/png', ref: cid2, size: 2000 }
 *   ]
 * }
 *
 * for (const blobRef of enumBlobRefs(record)) {
 *   console.log(blobRef.mimeType, blobRef.size)
 * }
 *
 * // Include legacy blob references
 * for (const ref of enumBlobRefs(record, { allowLegacy: true, strict: false })) {
 *   // ref may be BlobRef or LegacyBlobRef, with relaxed CID validation
 * }
 * ```
 */
export function enumBlobRefs(
  input: LexValue,
): Generator<BlobRef<RawCid>, void, unknown>
export function enumBlobRefs<TOptions extends EnumBlobRefsOptions>(
  input: LexValue,
  options: TOptions,
): Generator<InferEnumBlobRefs<TOptions>, void, unknown>
export function enumBlobRefs(
  input: LexValue,
  options?: EnumBlobRefsOptions,
): Generator<BlobRef | LegacyBlobRef, void, unknown>
export function* enumBlobRefs(
  input: LexValue,
  options?: EnumBlobRefsOptions,
): Generator<BlobRef | LegacyBlobRef, void, unknown> {
  // LegacyBlobRef not included by default
  const includeLegacy = options?.allowLegacy === true

  // Using a stack to avoid recursion depth issues.
  const stack: LexValue[] = [input]

  // Since we are using a stack, we could end-up in an infinite loop with cyclic
  // structures. Cyclic structures are not valid LexValues and should, thus,
  // never occur, but let's be safe.
  const visited = new Set<object>()

  do {
    const value = stack.pop()!

    if (value != null && typeof value === 'object') {
      if (Array.isArray(value)) {
        if (visited.has(value)) continue
        visited.add(value)
        stack.push(...value)
      } else if (isPlainProto(value)) {
        if (visited.has(value)) continue
        visited.add(value)
        if (isBlobRef(value, options)) {
          yield value
        } else if (includeLegacy && isLegacyBlobRef(value, options)) {
          yield value
        } else {
          for (const v of Object.values(value)) {
            if (v != null) stack.push(v)
          }
        }
      }
    }
  } while (stack.length > 0)

  // Optimization: ease GC's work
  visited.clear()
}
