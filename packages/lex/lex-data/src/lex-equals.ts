import { ifCid, isCid } from './cid.js'
import { LexValue } from './lex.js'
import { isPlainObject } from './object.js'
import { ui8Equals } from './uint8array.js'

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
