export function asArray<T>(value: T | T[]): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function asURL(value: string | { toString: () => string }): URL {
  return new URL(value)
}

export function ifURL(
  value: string | { toString: () => string },
): URL | undefined {
  try {
    return asURL(value)
  } catch {
    return undefined
  }
}
