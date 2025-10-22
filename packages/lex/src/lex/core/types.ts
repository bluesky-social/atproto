/**
 * Same as {@link string} but prevents TypeScript allowing union types to
 * be widened to `string` in IDEs.
 */
export type UnknownString = string & NonNullable<unknown>

// eslint-disable-next-line @typescript-eslint/ban-types
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

// @NOTE there is no way to express "array containing at least one P", so we use
// "array that contains P at first or last position" as a workaround.
export type ArrayContaining<T, Items = unknown> =
  | readonly [T, ...Items[]]
  | readonly [...Items[], T]
