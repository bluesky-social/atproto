/*@__NO_SIDE_EFFECTS__*/
export function memoizedOptions<F extends (options: any) => any>(fn: F): F {
  let undefinedOptionsValue: ReturnType<F> | undefined

  return function cached(options: unknown): ReturnType<F> {
    // Non-empty options case
    if (options !== undefined) return fn(options as Parameters<F>[0])

    // No options case
    return (undefinedOptionsValue ??= fn(options))
  } as F
}

/*@__NO_SIDE_EFFECTS__*/
export function memoizedTransformer<F extends (arg: any) => any>(fn: F): F {
  let cache: WeakMap<object, ReturnType<F>>

  return function cached(arg: object): ReturnType<F> {
    cache ??= new WeakMap()
    const cached = cache.get(arg)
    if (cached) return cached
    const result = fn(arg) as ReturnType<F>
    cache.set(arg, result)
    return result
  } as F
}
