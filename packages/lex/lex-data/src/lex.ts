import { CID, isCid } from './cid.js'
import { isPlainObject } from './object.js'

// @NOTE BlobRef is just a special case of LexMap.

export type LexScalar = number | string | boolean | null | CID | Uint8Array
export type LexValue = LexScalar | LexValue[] | { [_ in string]?: LexValue }
export type LexMap = { [_ in string]?: LexValue }
export type LexArray = LexValue[]

export const isLexMap: (value: LexValue) => value is LexMap = isPlainObject
export const isLexArray: (value: LexValue) => value is LexArray = Array.isArray
export const isLexScalar = (value: LexValue): value is LexScalar => {
  switch (typeof value) {
    case 'object':
      if (value === null) return true
      return value instanceof Uint8Array || isCid(value)
    case 'string':
    case 'boolean':
      return true
    case 'number':
      if (Number.isInteger(value)) return true
      throw new TypeError(`Invalid Lex value: ${value}`)
    default:
      throw new TypeError(`Invalid Lex value: ${typeof value}`)
  }
}

export function isLexValue(value: unknown): value is LexValue {
  switch (typeof value) {
    case 'number':
      if (!Number.isInteger(value)) return false
    // fallthrough
    case 'string':
    case 'boolean':
      return true
    case 'object':
      if (value === null) return true
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (!isLexValue(value[i])) return false
        }
        return true
      }
      if (isPlainObject(value)) {
        for (const key in value) {
          if (!isLexValue(value[key])) return false
        }
        return true
      }
      if (value instanceof Uint8Array) return true
      if (isCid(value)) return true
    // fallthrough
    default:
      return false
  }
}
