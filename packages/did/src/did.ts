import { z } from 'zod'
import { DigitChar, LowerAlphaChar } from './util'

const DID_PREFIX = 'did:'
const DID_PREFIX_LENGTH = DID_PREFIX.length
export { DID_PREFIX }

/**
 * Type representation of a Did, with method.
 *
 * ```ts
 * type DidWeb = Did<'web'> // `did:web:${string}`
 * type DidCustom = Did<'web' | 'plc'> // `did:${'web' | 'plc'}:${string}`
 * type DidNever = Did<' invalid 🥴 '> // never
 * type DidFoo = Did<'foo' | ' invalid 🥴 '> // `did:foo:${string}`
 * ```
 *
 * ```bnf
 * did                = "did:" method-name ":" method-specific-id
 * method-name        = 1*method-char
 * method-char        = %x61-7A / DIGIT
 * method-specific-id = *( *idchar ":" ) 1*idchar
 * idchar             = ALPHA / DIGIT / "." / "-" / "_" / pct-encoded
 * pct-encoded        = "%" HEXDIG HEXDIG
 * ```
 *
 * @see {@link https://www.w3.org/TR/did-core/#did-syntax}
 */
export type Did<M extends string = string> = `did:${AsDidMethod<M>}:${string}`

/**
 * DID Method
 */

export type AsDidMethod<M> = string extends M
  ? string // can't know...
  : AsDidMethodInternal<M, ''>

type AsDidMethodInternal<
  S,
  Acc extends string,
> = S extends `${infer H}${infer T}`
  ? H extends DigitChar | LowerAlphaChar
    ? AsDidMethodInternal<T, `${Acc}${H}`>
    : never
  : Acc extends ''
  ? never
  : Acc

/**
 * DID Method-name check function.
 *
 * Check if the input is a valid DID method name, at the position between
 * `start` (inclusive) and `end` (exclusive).
 */
export function isDidMethod(
  input: string,
  start = 0,
  end = input.length,
): input is string {
  if (end === start) return false
  if (!(end > start)) throw new TypeError('end < start')

  let c: number
  for (let i = start; i < end; i++) {
    c = input.charCodeAt(i)
    if (
      (c < 0x61 || c > 0x7a) && // a-z
      (c < 0x30 || c > 0x39) // 0-9
    ) {
      return false
    }
  }

  return true
}

/**
 * DID Method-specific identifier check function.
 *
 * Check if the input is a valid DID method-specific identifier, at the position
 * between `start` (inclusive) and `end` (exclusive).
 */
export function isDidMsid(
  input: string,
  start = 0,
  end = input.length,
): input is string {
  if (end === start) return false
  if (!(end > start)) throw new TypeError('end < start')

  let c: number
  for (let i = start; i < end; i++) {
    c = input.charCodeAt(i)

    // Check for frequent chars first
    if (
      (c < 0x61 || c > 0x7a) && // a-z
      (c < 0x41 || c > 0x5a) && // A-Z
      (c < 0x30 || c > 0x39) && // 0-9
      c !== 0x2e && // .
      c !== 0x2d && // -
      c !== 0x5f // _
    ) {
      // Less frequent chars are checked here

      // ":"
      if (c === 0x3a) {
        // cannot be the last char
        if (i === end - 1) return false
        continue
      }

      // pct-encoded
      if (c === 0x25) {
        c = input.charCodeAt(++i)
        if ((c < 0x30 || c > 0x39) && (c < 0x41 || c > 0x46)) return false

        c = input.charCodeAt(++i)
        if ((c < 0x30 || c > 0x39) && (c < 0x41 || c > 0x46)) return false

        // There must always be 2 HEXDIG after a "%"
        if (i >= end) return false

        continue
      }

      return false
    }
  }

  return true
}

export function isDid(input: string): input is Did
export function isDid<M extends string>(
  input: string,
  allowedMethodNames: readonly M[],
): input is Did<AsDidMethod<M>>

export function isDid(
  input: string,
  allowedMethodNames?: readonly string[],
): boolean {
  const { length } = input
  if (length > 2048) return false

  if (!input.startsWith(DID_PREFIX)) return false

  const idSep = input.indexOf(':', DID_PREFIX_LENGTH)
  if (idSep === -1) return false

  if (!isDidMethod(input, DID_PREFIX_LENGTH, idSep)) return false
  if (!isDidMsid(input, idSep + 1, length)) return false

  if (allowedMethodNames) {
    const methodName = input.slice(DID_PREFIX_LENGTH, idSep)
    if (!allowedMethodNames.includes(methodName)) return false
  }

  return true
}

export const didSchema = z.string().refinement(isDid, {
  code: z.ZodIssueCode.custom,
  message: 'Invalid DID',
})
