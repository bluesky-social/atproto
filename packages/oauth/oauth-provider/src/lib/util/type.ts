// eslint-disable-next-line @typescript-eslint/ban-types
export type Simplify<T> = { [K in keyof T]: T[K] } & {}
export type Override<T, V> = Simplify<{
  [K in keyof (V & T)]: K extends keyof V
    ? V[K]
    : K extends keyof T
      ? T[K]
      : never
}>
export type Awaitable<T> = T | Promise<T>
export type NonNullableKeys<T, K extends keyof T> = Simplify<
  OmitKey<T, K> & {
    [P in K]-?: NonNullable<T[P]>
  }
>
/**
 * When a type has an `[x: string]: unknown` index signature, in addition to
 * some known properties, using {@link Omit} will result in a type that only has
 * the index signature, and no known properties.
 *
 * ```ts
 * Omit<{ a: 3; b: 4; [x: string]: unknown }, 'a'> // { [x: string]: unknown }
 * ```
 *
 * In order to properly omit specific known properties from a type with an index
 * signature, we need to use another utility type that will behave correctly.
 *
 * ```ts
 * OmitKey<{ a: 3; b: 4; [x: string]: unknown }, 'a'> // { b: 4; [x: string]: unknown }
 * ```
 */
export type OmitKey<T, K extends keyof T> = {
  [K2 in keyof T as K2 extends K ? never : K2]: T[K2]
}

export type RequiredKey<T, K extends keyof T = never> = Simplify<
  T & {
    [L in K]-?: unknown extends T[L]
      ? NonNullable<unknown> | null
      : Exclude<T[L], undefined>
  }
>

/**
 * Converts a tuple to the equivalent type of combining every item into a single
 * one. If any of the item in the tuple is non nullish, the result will be non
 * nullish.
 */
export type CombinedTuple<T extends readonly unknown[]> = T extends []
  ? undefined
  : Exclude<
      T[number],
      // If any item in the tuple is never `null` (resp. `undefined`), exclude
      // `null` (resp. `undefined`) from `T[number]`
      {
        [K in keyof T]-?:
          | (null extends T[K] ? never : null)
          | (undefined extends T[K] ? never : undefined)
      }[keyof T]
    >

/**
 * Similar to {@link Required} but also ensures that all values are defined.
 */
export type RequiredDefined<T> = { [K in keyof T]-?: Exclude<T[K], undefined> }

// <hardcore-mode> (don't touch this)

/**
 * @example
 * ```ts
 * type F = UnionToFnUnion<'a' | 'b'> // (() => 'a') | (() => 'b')
 * ```
 */
type UnionToFnUnion<T> = T extends any ? () => T : never

/**
 * @example
 * ```ts
 * type A = UnionToIntersection<(() => 'a') | (() => 'b')> // (() => 'a') & (() => 'b')
 *
 * UnionToIntersection<{ foo: string | number } | { foo: number; bar: 4 }> // { foo: number; bar: 4 }
 * ```
 */
type UnionToIntersection<T> = (T extends any ? (x: T) => void : never) extends (
  x: infer U,
) => void
  ? U
  : never

/**
 * @example
 * ```ts
 * type B = ExtractUnionItem<'a' | 'b'> // 'b'
 * ```
 */
type ExtractUnionItem<T> =
  // There exists a quirk in the way TypeScript works when inferring return
  // types of an (disjoined) intersection of functions:
  //
  // type AnB = (() => 'a') & (() => 'b')
  // type B = AnB extends () => infer R ? R : never // 'b'
  //
  // By turning the input union T (e.g. 'a' | 'b') into a union of function
  // (() => 'a') | (() => 'b') and then into an intersection of those functions
  // (() => 'a') & (() => 'b'), we can exploit the special TypeScript behavior
  // to infer only the last return type from the functions, which is effectively
  // equal to the last item of the input union T.
  UnionToIntersection<UnionToFnUnion<T>> extends () => infer R ? R : never

/**
 * Utility that turn a union of types (`'a' | 'b'`) into a tuple with matching
 * types (`['a', 'b']`).
 *
 * @note this only work with unions of "const" types. Using this with globals
 * types (`string`, etc.) will yield unexpected results.
 *
 * @example
 * ```ts
 * type T = UnionToTuple<'a' | 'b'> // ['a', 'b']
 * type T = UnionToTuple<'a' | 'b' | 'c'> // ['a', 'b', 'c']
 * ```
 */
type UnionToTuple<T> = UnionToTupleInternal<T>

type UnionToTupleInternal<
  T,
  // Accumulator for terminal recursivity (initialized to empty tuple)
  Acc extends readonly any[] = [],
  // Get the next item from the union (if any)
  Next = ExtractUnionItem<T>,
> =
  // If there were no more items to extract from the union T, then we are done
  [Next] extends [never]
    ? // Return result of previous recursive calls
      Acc
    : // Recursively call UnionToTupleInternal by Exclude'ing the Next item from
      // the union (T) and adding it to the accumulator.
      UnionToTupleInternal<Exclude<T, Next>, readonly [Next, ...Acc]>

/**
 * This utility allows to create an assertion function that checks if a
 * particular interface is fully implemented by some value.
 *
 * The use of the (rather complex) {@link UnionToTuple} allows to ensure that,
 * at runtime, all the required interface keys are indeed checked, and that
 * future additions to the interface do not result in a false sense of type
 * safety.
 *
 * @note This function should not be made public, as it relies on a quirk of
 * TypeScript to work properly.
 *
 * @example Valid use
 *
 * ```ts
 * const isFoo = buildInterfaceChecker<{ foo: string }>(['foo'])
 * const isFooBar = buildInterfaceChecker<{ foo: string; bar: boolean }>([
 *   'foo',
 *   'bar',
 * ])
 *
 * declare const val: { foo?: string }
 *
 * if (isFoo(val)) {
 *   val // { foo: string }
 * }
 * ```
 *
 * @example Use cases where the runtime keys do not match the interface keys
 *
 * ```ts
 * buildInterfaceChecker<{ foo: string }>([])
 * buildInterfaceChecker<{ foo: string }>(['fee'])
 * buildInterfaceChecker<{ foo: string; bar: string }>(['foo'])
 * buildInterfaceChecker<{ foo: string; bar: string }>(['foo', 'baz'])
 * ```
 */
export const buildInterfaceChecker =
  <I extends object>(keys: readonly string[] & UnionToTuple<keyof I>) =>
  <V extends Partial<I>>(value: V): value is V & RequiredDefined<I> =>
    keys.every((name) => value[name] !== undefined)

// </hardcore-mode>
