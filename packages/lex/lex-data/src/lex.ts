import { CID, isCid } from './cid.js'
import { isPlainObject } from './object.js'

export type LexScalar = number | string | boolean | null | CID | Uint8Array
export type Lex = LexScalar | Lex[] | { [_ in string]?: Lex }
export type LexMap = { [_ in string]?: Lex }
export type LexArray = Lex[]

export const isLexMap: (value: Lex) => value is LexMap = isPlainObject
export const isLexArray: (value: Lex) => value is LexArray = Array.isArray
export const isLexScalar = (value: Lex): value is LexScalar => {
  if (value === null) return true
  if (typeof value !== 'object') return true
  return value instanceof Uint8Array || isCid(value)
}
