import { ifCid, isCid } from './cid.js'
import { LexValue } from './lex.js'
import { isPlainObject } from './object.js'
import { ui8Equals } from './uint8array.js'

/**
 * Performs deep equality comparison between two {@link LexValue}s.
 *
 * This function correctly handles all Lexicon data types including:
 * - Primitives (string, number, boolean, null)
 * - Arrays (recursive element comparison)
 * - Objects/LexMaps (recursive key-value comparison)
 * - Uint8Arrays (byte-by-byte comparison)
 * - CIDs (using CID equality)
 *
 * @param a - First LexValue to compare
 * @param b - Second LexValue to compare
 * @returns `true` if the values are deeply equal
 * @throws {TypeError} If either value is not a valid LexValue (e.g., contains unsupported types)
 *
 * @example
 * ```typescript
 * import { lexEquals } from '@atproto/lex-data'
 *
 * // Primitives
 * lexEquals('hello', 'hello')  // true
 * lexEquals(42, 42)            // true
 *
 * // Arrays
 * lexEquals([1, 2, 3], [1, 2, 3])  // true
 * lexEquals([1, 2], [1, 2, 3])     // false
 *
 * // Objects
 * lexEquals({ a: 1, b: 2 }, { a: 1, b: 2 })  // true
 * lexEquals({ a: 1 }, { a: 1, b: 2 })        // false
 *
 * // CIDs
 * lexEquals(cid1, cid2)  // true if CIDs are equal
 *
 * // Uint8Arrays
 * lexEquals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))  // true
 * ```
 */
export function lexEquals(a: LexValue, b: LexValue): boolean {
  if (Object.is(a, b)) {
    return true
  }

  if (
    a == null ||
    b == null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false
    }
    if (a.length !== b.length) {
      return false
    }
    for (let i = 0; i < a.length; i++) {
      if (!lexEquals(a[i], b[i])) {
        return false
      }
    }
    return true
  } else if (Array.isArray(b)) {
    return false
  }

  if (ArrayBuffer.isView(a)) {
    if (!ArrayBuffer.isView(b)) return false
    return ui8Equals(a, b)
  } else if (ArrayBuffer.isView(b)) {
    return false
  }

  if (isCid(a)) {
    // @NOTE CID.equals returns its argument when it is falsy (e.g. null or
    // undefined) so we need to explicitly check that the output is "true".
    return ifCid(b)?.equals(a) === true
  } else if (isCid(b)) {
    return false
  }

  if (!isPlainObject(a) || !isPlainObject(b)) {
    // Foolproof (should never happen)
    throw new TypeError(
      'Invalid LexValue (expected CID, Uint8Array, or LexMap)',
    )
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  if (aKeys.length !== bKeys.length) {
    return false
  }

  for (const key of aKeys) {
    const aVal = a[key]
    const bVal = b[key]

    // Needed because of the optional index signature in the Lex object type
    // though, in practice, aVal should never be undefined here.
    if (aVal === undefined) {
      if (bVal === undefined && bKeys.includes(key)) continue
      return false
    } else if (bVal === undefined) {
      return false
    }

    if (!lexEquals(aVal, bVal)) {
      return false
    }
  }

  return true
}
