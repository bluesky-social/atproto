import { base64url } from 'multiformats/bases/base64'
import { RefinementCtx, ZodIssueCode } from 'zod'

// eslint-disable-next-line @typescript-eslint/ban-types
export type Simplify<T> = { [K in keyof T]: T[K] } & {}
export type Override<T, V> = Simplify<V & Omit<T, keyof V>>

export type RequiredKey<T, K extends keyof T = never> = Simplify<
  T & {
    [L in K]-?: unknown extends T[L]
      ? NonNullable<unknown> | null
      : Exclude<T[L], undefined>
  }
>

// eslint-disable-next-line @typescript-eslint/ban-types
export type DeepReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T extends readonly (infer U)[]
      ? readonly DeepReadonly<U>[]
      : T

// eslint-disable-next-line @typescript-eslint/ban-types
export type UnReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { -readonly [K in keyof T]: UnReadonly<T[K]> }
    : T extends readonly (infer U)[]
      ? UnReadonly<U>[]
      : T

export const isDefined = <T>(i: T | undefined): i is T => i !== undefined

export const preferredOrderCmp =
  <T>(order: readonly T[]) =>
  (a: T, b: T) => {
    const aIdx = order.indexOf(a)
    const bIdx = order.indexOf(b)
    if (aIdx === bIdx) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  }

export function matchesAny<T extends string | number | symbol | boolean>(
  value: null | undefined | T | readonly T[],
): (v: unknown) => v is T {
  return value == null
    ? (v): v is T => true
    : Array.isArray(value)
      ? (v): v is T => value.includes(v)
      : (v): v is T => v === value
}

/**
 * Decorator to cache the result of a getter on a class instance.
 */
export const cachedGetter = <T extends object, V>(
  target: (this: T) => V,
  _context: ClassGetterDecoratorContext<T, V>,
) => {
  return function (this: T) {
    const value = target.call(this)
    Object.defineProperty(this, target.name, {
      get: () => value,
      enumerable: true,
      configurable: true,
    })
    return value
  }
}

const decoder = new TextDecoder()
export function parseB64uJson(input: string): unknown {
  const inputBytes = base64url.baseDecode(input)
  const json = decoder.decode(inputBytes)
  return JSON.parse(json)
}

/**
 * @example
 * ```ts
 * // jwtSchema will only allow base64url chars & "." (dot)
 * const jwtSchema = z.string().superRefine(jwtCharsRefinement)
 * ```
 */
export const jwtCharsRefinement = (data: string, ctx: RefinementCtx): void => {
  // Note: this is a hot path, let's avoid using a RegExp
  let char

  for (let i = 0; i < data.length; i++) {
    char = data.charCodeAt(i)

    if (
      // Base64 URL encoding (most frequent)
      (65 <= char && char <= 90) || // A-Z
      (97 <= char && char <= 122) || // a-z
      (48 <= char && char <= 57) || // 0-9
      char === 45 || // -
      char === 95 || // _
      // Boundary (least frequent, check last)
      char === 46 // .
    ) {
      // continue
    } else {
      // Invalid char might be a surrogate pair
      const invalidChar = String.fromCodePoint(data.codePointAt(i)!)
      return ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `Invalid character "${invalidChar}" in JWT at position ${i}`,
      })
    }
  }
}

/**
 * @example
 * ```ts
 * type SegmentedString3 = SegmentedString<3> // `${string}.${string}.${string}`
 * type SegmentedString4 = SegmentedString<4> // `${string}.${string}.${string}.${string}`
 * ```
 *
 * @note
 * This utility only provides one way type safety (A SegmentedString<4> can be
 * assigned to SegmentedString<3> but not vice versa). The purpose of this
 * utility is to improve DX by avoiding as many potential errors as build time.
 * DO NOT rely on this to enforce security or data integrity.
 */
type SegmentedString<
  C extends number,
  Acc extends string[] = [string],
> = Acc['length'] extends C
  ? `${Acc[0]}`
  : `${Acc[0]}.${SegmentedString<C, [string, ...Acc]>}`

/**
 * @example
 * ```ts
 * const jwtSchema = z.string().superRefine(segmentedStringRefinementFactory(3))
 * type Jwt = z.infer<typeof jwtSchema> // `${string}.${string}.${string}`
 * ```
 */
export const segmentedStringRefinementFactory = <C extends number>(
  count: C,
  minPartLength = 2,
) => {
  if (!Number.isFinite(count) || count < 1 || (count | 0) !== count) {
    throw new TypeError(`Count must be a natural number (got ${count})`)
  }

  const minTotalLength = count * minPartLength + (count - 1)
  const errorPrefix = `Invalid JWT format`

  return (data: string, ctx: RefinementCtx): data is SegmentedString<C> => {
    if (data.length < minTotalLength) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `${errorPrefix}: too short`,
      })
      return false
    }
    let currentStart = 0
    for (let i = 0; i < count - 1; i++) {
      const nextDot = data.indexOf('.', currentStart)
      if (nextDot === -1) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: `${errorPrefix}: expected ${count} segments, got ${i + 1}`,
        })
        return false
      }
      if (nextDot - currentStart < minPartLength) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: `${errorPrefix}: segment ${i + 1} is too short`,
        })
        return false
      }
      currentStart = nextDot + 1
    }
    if (data.indexOf('.', currentStart) !== -1) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `${errorPrefix}: too many segments`,
      })
      return false
    }
    if (data.length - currentStart < minPartLength) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `${errorPrefix}: last segment is too short`,
      })
      return false
    }
    return true
  }
}
