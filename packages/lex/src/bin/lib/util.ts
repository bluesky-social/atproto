import { relative } from 'node:path'

export function memoize<T extends (arg: string) => NonNullable<unknown> | null>(
  fn: T,
): T {
  const cache = new Map<string, NonNullable<unknown> | null>()
  return ((arg: string) => {
    const cached = cache.get(arg)
    if (cached !== undefined) return cached
    const result = fn(arg)
    cache.set(arg, result)
    return result
  }) as T
}

export function ucFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function asRelativePath(from: string, to: string) {
  const relPath = relative(from, to)
  return relPath.startsWith('./') || relPath.startsWith('../')
    ? relPath
    : `./${relPath}`
}
