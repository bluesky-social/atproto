/**
 * Same as `string` but prevents TypeScript from allowing union types to
 * be widened to `string` in IDEs.
 *
 * This is useful when you want autocompletion for known string values
 * while still allowing arbitrary strings.
 *
 * @example
 * ```typescript
 * // With plain string, union is widened:
 * type Status1 = 'active' | 'inactive' | string // just becomes "string"
 *
 * // With UnknownString, union is preserved:
 * type Status2 = 'active' | 'inactive' | UnknownString
 * // Autocomplete will suggest 'active' and 'inactive'
 * ```
 */
export type UnknownString = string & NonNullable<unknown>

/**
 * Simplifies a type by expanding intersections and mapped types.
 *
 * This improves IDE tooltips by showing the actual shape of a type
 * rather than complex intersections.
 *
 * @typeParam T - The type to simplify
 *
 * @example
 * ```typescript
 * type Complex = { a: string } & { b: number }
 * type Simple = Simplify<Complex>
 * // Hover shows: { a: string; b: number }
 * ```
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

/**
 * Internal symbol for branding restricted types.
 * @internal
 */
declare const __restricted: unique symbol

/**
 * A type that represents a value that cannot be used, with a custom
 * message explaining the restriction.
 *
 * This is useful for creating "never use this" types that provide
 * helpful error messages when someone tries to use them.
 *
 * @typeParam Message - A string literal type containing the error message
 *
 * @example
 * ```typescript
 * type DeprecatedField = Restricted<'This field has been deprecated. Use newField instead.'>
 *
 * interface MyType {
 *   oldField?: DeprecatedField
 *   newField: string
 * }
 *
 * const obj: MyType = {
 *   oldField: 'value', // Error: Type 'string' is not assignable to type 'Restricted<...>'
 *   newField: 'value'
 * }
 * ```
 */
export type Restricted<Message extends string> = typeof __restricted & {
  [__restricted]: Message
}

/**
 * Converts all properties of `P` that may be `undefined` into actual
 * optional properties on the resulting type.
 *
 * This is useful when working with types where some properties are typed as
 * `T | undefined` but should really be optional (`T?`).
 *
 * @typeParam P - The object type to transform
 *
 * @example
 * ```typescript
 * type Input = {
 *   required: string
 *   optional: string | undefined
 * }
 *
 * type Output = WithOptionalProperties<Input>
 * // Result: {
 * //   required: string
 * //   optional?: string | undefined
 * // }
 * ```
 */
export type WithOptionalProperties<P> = Simplify<
  {
    -readonly [K in keyof P as undefined extends P[K] ? never : K]-?: P[K]
  } & {
    -readonly [K in keyof P as undefined extends P[K] ? K : never]?: P[K]
  }
>

/**
 * Creates a type by omitting a specific key from an object type.
 *
 * Similar to TypeScript's built-in `Omit`, but preserves the type structure
 * more accurately in some edge cases.
 *
 * @typeParam T - The object type to transform
 * @typeParam K - The key to omit (must be a key of T)
 *
 * @example
 * ```typescript
 * type Person = { name: string; age: number; email: string }
 * type PersonWithoutEmail = OmitKey<Person, 'email'>
 * // Result: { name: string; age: number }
 * ```
 */
export type OmitKey<T, K extends keyof T> = {
  [K2 in keyof T as K2 extends K ? never : K2]: T[K2]
}
