/**
 * Same as {@link string} but prevents TypeScript allowing union types to
 * be widened to `string` in IDEs.
 */
export type UnknownString = string & NonNullable<unknown>

export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

// @NOTE there is no way to express "array containing at least one P", so we use
// "array that contains P at first or last position" as a workaround.
export type ArrayContaining<T, Items = unknown> =
  | readonly [T, ...Items[]]
  | readonly [...Items[], T]

declare const __restricted: unique symbol
/**
 * A type that represents a value that cannot be used, with a custom
 * message explaining the restriction.
 */
export type Restricted<Message extends string> = typeof __restricted & {
  [__restricted]: Message
}
