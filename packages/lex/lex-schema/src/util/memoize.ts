/*@__NO_SIDE_EFFECTS__*/
export function memoizedOptions<F extends (...args: any[]) => any>(fn: F): F {
  let cache: null | { value: ReturnType<F> } = null

  return function cached(...args: any[]): ReturnType<F> {
    // Not using the cache if there are args
    if (args.length > 0) {
      return fn(...args)
    }

    if (cache != null) {
      return cache.value
    }

    const value = fn(...args)
    cache = { value }
    return value
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
