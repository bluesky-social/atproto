export type ParamValue = string | number | boolean

export type NeArray<T> = [T, ...T[]]

/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

/**
 * Checks if an array is non-empty.
 */
export function isNonEmpty<T>(value?: T[]): value is NeArray<T>
export function isNonEmpty<T>(value?: readonly T[]): value is NeRoArray<T>
export function isNonEmpty(value?: readonly unknown[]): boolean {
  return value != null && value.length > 0
}

export type ScopeStringFor<P extends string> =
  P | `${P}:${string}` | `${P}?${string}`

/**
 * Allows to quickly check if a scope is for a specific resource.
 */
export function isScopeStringFor<P extends string>(
  value: string,
  prefix: P,
): value is ScopeStringFor<P> {
  if (value.length > prefix.length) {
    // First, check the next char is either : or ?
    const nextChar = value.charCodeAt(prefix.length)
    if (nextChar !== 0x3a /* : */ && nextChar !== 0x3f /* ? */) {
      return false
    }

    // Then check the full prefix
    return value.startsWith(prefix)
  } else {
    // value and prefix must be equal
    return value === prefix
  }
}

/**
 * Abstract interface that allows parsing various syntaxes into permission
 * representations.
 */
export interface ScopeSyntax<P extends string> {
  readonly prefix: P
  readonly positional?: ParamValue
  keys(): Iterable<string, void, unknown>
  getSingle(key: string): ParamValue | null | undefined
  getMulti(key: string): readonly ParamValue[] | null | undefined
}

export function isScopeSyntaxFor<P extends string>(
  syntax: ScopeSyntax<string>,
  prefix: P,
): syntax is ScopeSyntax<P> {
  return syntax.prefix === prefix
}
