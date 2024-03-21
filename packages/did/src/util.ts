import { z } from 'zod'

export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export function wellKnownUrl(base: URL, path: string) {
  const lastSlash = base.pathname.lastIndexOf('/')

  const prefix =
    lastSlash <= 0 ? `/.well-known/` : base.pathname.slice(0, lastSlash)

  return new URL(`${prefix}/${path}`, base)
}

export type DigitChar =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'

export type LowerAlphaChar =
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

export function asRefinement<T, R>(check: (value: T) => void) {
  return (value: T, ctx: z.RefinementCtx): value is T & R => {
    try {
      check(value)
      return true
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Unexpected error',
      })
      return false
    }
  }
}
