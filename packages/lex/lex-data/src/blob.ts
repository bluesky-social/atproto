import {
  Cid,
  RAW_BIN_MULTICODEC,
  SHA2_256_MULTIHASH_CODE,
  asCid,
  parseCid,
} from './cid.js'
import { LexValue } from './lex.js'
import { isPlainObject, isPlainProto } from './object.js'

/**
 * @note {@link BlobRef} is just a {@link LexMap} with a specific shape.
 */
export type BlobRef = {
  $type: 'blob'
  mimeType: string
  ref: Cid
  size: number
}

export type BlobRefValidationOptions = {
  /**
   * If `false`, skips strict CID validation of {@link BlobRef.ref}, allowing
   * any valid CID. Otherwise, validates that the CID is v1, uses the raw
   * multicodec, and has a sha256 multihash.
   *
   * @defaults to `true`
   */
  strict?: boolean
}

export function isBlobRef(
  input: unknown,
  options?: BlobRefValidationOptions,
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

  const cid = asCid(ref)
  if (!cid) {
    return false
  }

  if (options?.strict !== false) {
    if (cid.version !== 1) {
      return false
    }
    if (cid.code !== RAW_BIN_MULTICODEC) {
      return false
    }
    if (cid.multihash.code !== SHA2_256_MULTIHASH_CODE) {
      return false
    }
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

  try {
    parseCid(cid)
  } catch {
    return false
  }

  return true
}

export type EnumBlobRefsOptions = BlobRefValidationOptions & {
  /**
   * @defaults to `false`
   */
  allowLegacy?: boolean
}

/**
 * Enumerates all {@link BlobRef}s (and, optionally, {@link LegacyBlobRef}s)
 * found within a {@link LexValue}.
 */
export function enumBlobRefs(
  input: LexValue,
  options: EnumBlobRefsOptions & { allowLegacy: true },
): Generator<BlobRef | LegacyBlobRef, void, unknown>
export function enumBlobRefs(
  input: LexValue,
  options?: EnumBlobRefsOptions & { allowLegacy?: false },
): Generator<BlobRef, void, unknown>
export function enumBlobRefs(
  input: LexValue,
  options?: EnumBlobRefsOptions,
): Generator<BlobRef | LegacyBlobRef, void, unknown>
export function* enumBlobRefs(
  input: LexValue,
  options?: EnumBlobRefsOptions,
): Generator<BlobRef | LegacyBlobRef, void, unknown> {
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
