import { CID, isCid } from './cid.js'
import { isPlainObject } from './object.js'

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
      if (Array.isArray(value)) return value.every(isLexValue)
      if (isPlainObject(value)) return Object.values(value).every(isLexValue)
      if (value instanceof Uint8Array) return true
      if (isCid(value)) return true
    // fallthrough
    default:
      return false
  }
}
