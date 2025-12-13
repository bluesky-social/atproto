/**
 * Same as {@link string} but prevents TypeScript allowing union types to
 * be widened to `string` in IDEs.
 */
export type UnknownString = string & NonNullable<unknown>

export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

declare const __restricted: unique symbol
/**
 * A type that represents a value that cannot be used, with a custom
 * message explaining the restriction.
 */
export type Restricted<Message extends string> = typeof __restricted & {
  [__restricted]: Message
}

/**
 * Converts all properties of `P` that are optional (i.e. may be `undefined`)
 * into actual optional properties on the resulting type.
 */
export type WithOptionalProperties<P> = Simplify<
  {
    -readonly [K in keyof P as undefined extends P[K] ? never : K]-?: P[K]
  } & {
    -readonly [K in keyof P as undefined extends P[K] ? K : never]?: P[K]
  }
>

export type OmitKey<T, K extends keyof T> = {
  [K2 in keyof T as K2 extends K ? never : K2]: T[K2]
}
