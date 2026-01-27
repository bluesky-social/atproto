import { Cid, isCid } from './cid.js'
import { isPlainObject, isPlainProto } from './object.js'

export type LexScalar = number | string | boolean | null | Cid | Uint8Array
export type LexValue = LexScalar | LexValue[] | { [_ in string]?: LexValue }
export type LexMap = { [_ in string]?: LexValue }
export type LexArray = LexValue[]

export function isLexMap(value: unknown): value is LexMap {
  return isPlainObject(value) && Object.values(value).every(isLexValue)
}

export function isLexArray(value: unknown): value is LexArray {
  return Array.isArray(value) && value.every(isLexValue)
}

export function isLexScalar(value: unknown): value is LexScalar {
  switch (typeof value) {
    case 'object':
      return value === null || value instanceof Uint8Array || isCid(value)
    case 'string':
    case 'boolean':
      return true
    case 'number':
      if (Number.isInteger(value)) return true
    // fallthrough
    default:
      return false
  }
}

export function isLexValue(value: unknown): value is LexValue {
  // Using a stack to avoid recursion depth issues.
  const stack: unknown[] = [value]
  // Cyclic structures are not valid LexValues as they cannot be serialized to
  // JSON or CBOR. This also allows us to avoid infinite loops when traversing
  // the structure.
  const visited = new Set<object>()

  do {
    const value = stack.pop()!

    // Optimization: we are not using `isLexScalar` here to avoid extra function
    // calls, and to avoid computing `typeof value` multiple times.
    switch (typeof value) {
      case 'object':
        if (value === null) {
          // LexScalar
        } else if (isPlainProto(value)) {
          if (visited.has(value)) return false
          visited.add(value)
          stack.push(...Object.values(value))
        } else if (Array.isArray(value)) {
          if (visited.has(value)) return false
          visited.add(value)
          stack.push(...value)
        } else if (value instanceof Uint8Array || isCid(value)) {
          // LexScalar
        } else {
          return false
        }
        break
      case 'string':
      case 'boolean':
        break
      case 'number':
        if (Number.isInteger(value)) break
      // fallthrough
      default:
        return false
    }
  } while (stack.length > 0)

  // Optimization: ease GC's work
  visited.clear()

  return true
}

export type TypedLexMap = LexMap & { $type: string }
export function isTypedLexMap(value: LexValue): value is TypedLexMap {
  return (
    isLexMap(value) && typeof value.$type === 'string' && value.$type.length > 0
  )
}
