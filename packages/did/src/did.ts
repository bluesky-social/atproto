import { z } from 'zod'
import { DigitChar, LowerAlphaChar, asRefinement } from './util.js'
import { DidError, InvalidDidError } from './did-error.js'

const DID_PREFIX = 'did:'
const DID_PREFIX_LENGTH = DID_PREFIX.length
export { DID_PREFIX }

/**
 * Type representation of a Did, with method.
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
 * @example
 * ```ts
 * type DidWeb = Did<'web'> // `did:web:${string}`
 * type DidCustom = Did<'web' | 'plc'> // `did:${'web' | 'plc'}:${string}`
 * type DidNever = Did<' invalid 🥴 '> // never
 * type DidFoo = Did<'foo' | ' invalid 🥴 '> // `did:foo:${string}`
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
export function checkDidMethod(
  input: string,
  start = 0,
  end = input.length,
): void {
  if (!(end >= start)) {
    throw new TypeError('end < start')
  }
  if (end === start) {
    throw new InvalidDidError(input, `Empty method name`)
  }

  let c: number
  for (let i = start; i < end; i++) {
    c = input.charCodeAt(i)
    if (
      (c < 0x61 || c > 0x7a) && // a-z
      (c < 0x30 || c > 0x39) // 0-9
    ) {
      throw new InvalidDidError(input, `Invalid character at position ${i}`)
    }
  }
}

/**
 * This method assumes the input is a valid Did
 */
export function extractDidMethod<D extends Did>(did: D) {
  const msidSep = did.indexOf(':', DID_PREFIX_LENGTH)
  const method = did.slice(DID_PREFIX_LENGTH, msidSep)
  return method as D extends Did<infer M> ? M : string
}

/**
 * DID Method-specific identifier check function.
 *
 * Check if the input is a valid DID method-specific identifier, at the position
 * between `start` (inclusive) and `end` (exclusive).
 */
export function checkDidMsid(
  input: string,
  start = 0,
  end = input.length,
): void {
  if (!(end >= start)) {
    throw new TypeError('end < start')
  }
  if (end === start) {
    throw new InvalidDidError(input, `Empty method-specific id`)
  }

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
        if (i === end - 1) {
          throw new InvalidDidError(input, `DID cannot end with ":"`)
        }
        continue
      }

      // pct-encoded
      if (c === 0x25) {
        c = input.charCodeAt(++i)
        if ((c < 0x30 || c > 0x39) && (c < 0x41 || c > 0x46)) {
          throw new InvalidDidError(
            input,
            `Invalid pct-encoded character at position ${i}`,
          )
        }

        c = input.charCodeAt(++i)
        if ((c < 0x30 || c > 0x39) && (c < 0x41 || c > 0x46)) {
          throw new InvalidDidError(
            input,
            `Invalid pct-encoded character at position ${i}`,
          )
        }

        // There must always be 2 HEXDIG after a "%"
        if (i >= end) {
          throw new InvalidDidError(
            input,
            `Incomplete pct-encoded character at position ${i - 2}`,
          )
        }

        continue
      }

      throw new InvalidDidError(
        input,
        `Disallowed characters in DID at position ${i}`,
      )
    }
  }
}

export function checkDid(input: string): asserts input is Did {
  const { length } = input
  if (length > 2048) {
    throw new InvalidDidError(input, `DID is too long (2048 chars max)`)
  }

  if (!input.startsWith(DID_PREFIX)) {
    throw new InvalidDidError(input, `DID requires "${DID_PREFIX}" prefix`)
  }

  const idSep = input.indexOf(':', DID_PREFIX_LENGTH)
  if (idSep === -1) {
    throw new InvalidDidError(input, `Missing colon after method name`)
  }

  checkDidMethod(input, DID_PREFIX_LENGTH, idSep)
  checkDidMsid(input, idSep + 1, length)
}

export function isDid(input: string): input is Did {
  try {
    checkDid(input)
    return true
  } catch (err) {
    if (err instanceof DidError) {
      return false
    }
    throw err
  }
}

export const didSchema = z
  .string()
  .superRefine(asRefinement<string, Did>(checkDid))
