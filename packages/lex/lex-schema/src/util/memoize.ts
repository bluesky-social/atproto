/*@__NO_SIDE_EFFECTS__*/
export function memoizedOptions<F extends (...args: any[]) => any>(fn: F): F {
  let undefinedOptionsValue: ReturnType<F> | undefined

  return function cached(...args: any[]): ReturnType<F> {
    // Non-empty options case
    if (args.length > 0) return fn(...args)

    // No options case
    return (undefinedOptionsValue ??= fn())
  } as F
}

/*@__NO_SIDE_EFFECTS__*/
export function memoizedTransformer<
  F extends (key: any, ...args: any[]) => unknown,
>(fn: F): F {
  let cache: WeakMap<object, ReturnType<F>>

  return function cached(key: any, ...args: any[]): any {
    if (args.length > 0) return fn(key, ...args)

    cache ??= new WeakMap()
    const cached = cache.get(key)
    if (cached) return cached
    const result = fn(key, ...args) as ReturnType<F>
    cache.set(key, result)
    return result
  } as F
}
