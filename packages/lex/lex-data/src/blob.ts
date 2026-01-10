import { Cid, RawCid, ifCid, validateCidString } from './cid.js'
import { LexValue } from './lex.js'
import { isPlainObject, isPlainProto } from './object.js'

/**
 * @note {@link BlobRef} is just a {@link LexMap} with a specific shape.
 */
export type BlobRef<Ref extends Cid = Cid> = {
  $type: 'blob'
  mimeType: string
  ref: Ref
  size: number
}

export type BlobRefCheckOptions = {
  /**
   * If `false`, skips strict CID validation of {@link BlobRef.ref}, allowing
   * any valid CID. Otherwise, validates that the CID is v1, uses the raw
   * multicodec, and has a sha256 multihash.
   *
   * @defaults to `true`
   */
  strict?: boolean
}

export type InferCheckedBlobRef<TOptions extends BlobRefCheckOptions> =
  TOptions extends { strict: false }
    ? BlobRef
    : { strict: boolean } extends TOptions
      ? BlobRef
      : BlobRef<RawCid>

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
 * @note {@link LegacyBlobRef} is just a {@link LexMap} with a specific shape.
 */
export type LegacyBlobRef = {
  cid: string
  mimeType: string
}

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

export type EnumBlobRefsOptions = BlobRefCheckOptions & {
  /**
   * @defaults to `false`
   */
  allowLegacy?: boolean
}

export type InferEnumBlobRefs<TOptions extends EnumBlobRefsOptions> =
  TOptions extends { allowLegacy: true }
    ? InferCheckedBlobRef<TOptions> | LegacyBlobRef
    : { allowLegacy: boolean } extends TOptions
      ? InferCheckedBlobRef<TOptions> | LegacyBlobRef
      : InferCheckedBlobRef<TOptions>

/**
 * Enumerates all {@link BlobRef}s (and, optionally, {@link LegacyBlobRef}s)
 * found within a {@link LexValue}.
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
