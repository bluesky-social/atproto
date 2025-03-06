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
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

/**
 * @example
 * ```ts
 * type B = ExtractUnionType<'a' | 'b'> // 'b'
 * ```
 */
type ExtractUnionType<T> =
  // We first convert the input (T) union (e.g. 'a' | 'b') into a union of
  // functions that return the same results ((() => 'a') | (() => 'b')). We
  // transform that into an intersection (() => 'a') & (() => 'b'), which will
  // allow us to extract 'b' using a quirk in the way TypeScript works when
  // inferring return types.
  UnionToIntersection<UnionToFnUnion<T>> extends () => infer R ? R : never

/**
 * @example
 * ```ts
 * type T = UnionToTuple<'a' | 'b'> // readonly ['a', 'b']
 * type T = UnionToTuple<'a' | 'b' | 'c'> // readonly ['a', 'b', 'c']
 * ```
 */
type UnionToTuple<
  T,
  // Accumulator for recursive calls (initialized to an empty tuple)
  Acc extends readonly any[] = [],
  // Extract one of the union items
  Next = ExtractUnionType<T>,
  // Determine if T contains more union items or if it is "empty" (never)
  Done = [T] extends [never] ? true : false,
> = true extends Done
  ? // If T is "empty", we are done, return the result of previous iterations
    Acc
  : // Recursively call UnionToTuple by combining Next to the current
    // accumulator, and excluding Next from the union:
    UnionToTuple<Exclude<T, Next>, readonly [Next, ...Acc]>

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
