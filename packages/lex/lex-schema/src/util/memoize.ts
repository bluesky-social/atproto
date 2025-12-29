/*@__NO_SIDE_EFFECTS__*/
export function memoizedOptions<
  F extends (options?: NonNullable<unknown>) => any,
>(
  fn: F,
  keyFn?: (
    options: NonNullable<Parameters<F>[0]>,
  ) => string | number | boolean | null | void,
): F {
  let emptyOptionsValue: ReturnType<F> | undefined

  if (keyFn) {
    const cache = new Map<string | number | boolean | null, ReturnType<F>>()
    const fromCache = (
      options: NonNullable<Parameters<F>[0]>,
    ): ReturnType<F> => {
      const key = keyFn(options)
      if (key !== undefined) {
        const cached = cache.get(key)
        if (cached) return cached
        const result = fn(options) as ReturnType<F>
        cache.set(key, result)
        return result
      }

      return fn(options)
    }

    return ((options: Parameters<F>[0]): ReturnType<F> => {
      // Non-empty options case
      if (options) for (const _ in options) return fromCache(options)

      // Empty or missing options case
      return (emptyOptionsValue ??= fn(options))
    }) as F
  }

  return ((options: Parameters<F>[0]): ReturnType<F> => {
    // Non-empty options case
    if (options) for (const _ in options) return fn(options)

    // Empty or missing options case
    return (emptyOptionsValue ??= fn(options))
  }) as F
}

/*@__NO_SIDE_EFFECTS__*/
export function memoizedTransformer<F extends (arg: any) => any>(fn: F): F {
  const cache = new WeakMap<object, ReturnType<F>>()
  return ((arg: Parameters<F>[0]): ReturnType<F> => {
    const cached = cache.get(arg)
    if (cached) return cached
    const result = fn(arg) as ReturnType<F>
    cache.set(arg, result)
    return result
  }) as F
}
