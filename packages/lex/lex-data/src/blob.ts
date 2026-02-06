import { Cid, RawCid, ifCid, validateCidString } from './cid.js'
import { LexValue } from './lex.js'
import { isPlainObject, isPlainProto } from './object.js'

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

  if (typeof size !== 'number' || size < 0 || !Number.isSafeInteger(size)) {
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
 * Type guard to check if a value is a valid {@link LegacyBlobRef}.
 *
 * Validates the structure of the input:
 * - `cid` must be a valid CID string
 * - `mimeType` must be a non-empty string
 * - No additional properties allowed
 *
 * @param input - The value to check
 * @returns `true` if the input is a valid LegacyBlobRef
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
export function isLegacyBlobRef(input: unknown): input is LegacyBlobRef {
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

  if (!validateCidString(cid)) {
    return false
  }

  return true
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
 * for (const ref of enumBlobRefs(record, { allowLegacy: true })) {
 *   // ref may be BlobRef or LegacyBlobRef
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
        } else if (includeLegacy && isLegacyBlobRef(value)) {
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
