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
  // We first convert the input (T) union (e.g. 'a' | 'b') into a union of
  // functions that return the same results ((() => 'a') | (() => 'b')). We
  // transform that into an intersection (() => 'a') & (() => 'b'), which will
  // allow us to extract 'b' using a quirk in the way TypeScript works when
  // inferring return types.
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
 * type T = UnionToTuple<'a' | 'b'> // readonly ['a', 'b']
 * type T = UnionToTuple<'a' | 'b' | 'c'> // readonly ['a', 'b', 'c']
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
 * particular interface is fully implemented but some value.
 *
 * This relies on the (rather complex) {@link UnionToTuple} to ensure that, at
 * runtime, all the required interface keys are indeed checked, and that future
 * additions to the interface do not result in a false sense of type safety.
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
