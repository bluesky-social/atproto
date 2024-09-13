import { z } from 'zod'
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

type AlphanumericChar = DigitChar | LowerAlphaChar
type DigitChar = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type LowerAlphaChar =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'

type AsDidMethodInternal<
  S,
  Acc extends string,
> = S extends `${infer H}${infer T}`
  ? H extends AlphanumericChar
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
export function assertDidMethod(
  input: string,
  start = 0,
  end = input.length,
): void {
  if (
    !Number.isFinite(end) ||
    !Number.isFinite(start) ||
    end < start ||
    end > input.length
  ) {
    throw new TypeError('Invalid start or end position')
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
      throw new InvalidDidError(
        input,
        `Invalid character at position ${i} in DID method name`,
      )
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
export function assertDidMsid(
  input: string,
  start = 0,
  end = input.length,
): void {
  if (
    !Number.isFinite(end) ||
    !Number.isFinite(start) ||
    end < start ||
    end > input.length
  ) {
    throw new TypeError('Invalid start or end position')
  }
  if (end === start) {
    throw new InvalidDidError(input, `DID method-specific id must not be empty`)
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
        `Disallowed character in DID at position ${i}`,
      )
    }
  }
}

export function assertDid(input: unknown): asserts input is Did {
  if (typeof input !== 'string') {
    throw new InvalidDidError(typeof input, `DID must be a string`)
  }

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

  assertDidMethod(input, DID_PREFIX_LENGTH, idSep)
  assertDidMsid(input, idSep + 1, length)
}

export function isDid(input: unknown): input is Did {
  try {
    assertDid(input)
    return true
  } catch (err) {
    if (err instanceof DidError) {
      return false
    }

    // Unexpected TypeError (should never happen)
    throw err
  }
}

export function asDid(input: unknown): Did {
  assertDid(input)
  return input
}

export const didSchema = z
  .string()
  .superRefine((value: string, ctx: z.RefinementCtx): value is Did => {
    try {
      assertDid(value)
      return true
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Unexpected error',
      })
      return false
    }
  })
