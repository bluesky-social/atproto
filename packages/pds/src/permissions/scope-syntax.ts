/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

/**
 * Allows to quickly check if a scope is for a specific resource.
 */
export function isScopeForResource<R extends string>(
  scope: string,
  resource: R,
): scope is R | `${R}:${string}` | `${R}?${string}` {
  if (!scope.startsWith(resource)) return false
  if (scope.length === resource.length) return true

  const nextCharCode = scope.charCodeAt(resource.length)
  return nextCharCode === 0x3a /* : */ || nextCharCode === 0x3f /* ? */
}

/**
 * Utility class to parse and interpret the resource scope syntax used in
 * atproto oauth scopes.
 * The syntax is defined as follows:
 * ```nbf
 * scope := resource [':' positional] ['?' params]
 * params := param ['&' param]*
 * param := name '=' value
 * ```
 * Where "positional" can be used as short-hand (i.e. not used in combination
 * with) for a specific parameter.
 */
export class ParsedResourceScope<R extends string = string> {
  constructor(
    public readonly resource: R,
    public readonly positional?: string,
    public readonly params?: Readonly<URLSearchParams>,
  ) {}

  is<T extends string>(resource: T): this is ParsedResourceScope<T> {
    return this.resource === (resource as string)
  }

  containsParamsOtherThan(allowedParam: readonly string[]): boolean {
    const { params } = this
    if (params) {
      for (const key of params.keys()) {
        if (!allowedParam.includes(key)) return true
      }
    }

    return false
  }

  /**
   * Retrieve the value of a parameter that only allows a single value. If the
   * parameter is not found, it will return `undefined`. If the syntax is
   * incorrect (i.e. the parameter has multiple values), it will return `null`.
   */
  getSingle(name: string, isPositional = false): string | undefined | null {
    const { params } = this
    const values =
      params != null && params.has(name)
        ? (params.getAll(name) as [string, ...string[]])
        : undefined

    if (!values) {
      // No named parameter found, use positional parameter
      if (isPositional) return this.positional

      return undefined
    }

    if (values.length !== 1) {
      // Single value expected
      return null
    }

    if (isPositional && this.positional !== undefined) {
      // Positional parameter cannot be used with named parameters
      return null
    }

    return values[0]
  }

  /**
   * Retrieve the values of a parameter that allows multiple values. If the
   * parameter is not found, it will return `undefined`. If the syntax is
   * incorrect (i.e. there is bot a positional and named parameter), it will
   * return `null`.
   */
  getMulti(
    name: string,
    isPositional?: false,
  ): readonly [string, ...string[]] | undefined
  getMulti(
    name: string,
    isPositional: true, // Only if this arg is true, will this method return null
  ): readonly [string, ...string[]] | null | undefined
  getMulti(
    name: string,
    isPositional = false,
  ): readonly [string, ...string[]] | null | undefined {
    const { params } = this
    const values =
      params != null && params.has(name)
        ? (params.getAll(name) as [string, ...string[]])
        : undefined

    if (!values) {
      // No named parameter found, use positional parameter

      if (isPositional && this.positional !== undefined) {
        return [this.positional]
      }

      return undefined
    }

    if (isPositional && this.positional !== undefined) {
      // @NOTE we *could* return [this.positional, ...values] here but the
      // atproto scope syntax forbids use of both positional and named
      // parameters.
      return null
    }

    return values
  }

  toString(): string {
    let scope: string = this.resource

    if (this.positional) {
      scope += `:${encodeURIComponent(this.positional)}`
    }

    if (this.params?.size) {
      scope += `?${this.params.toString()}`
    }

    return scope
  }

  static fromString<R extends string>(
    scope: R | `${R}:${string}` | `${R}?${string}`,
  ): ParsedResourceScope<R> {
    const paramIdx = scope.indexOf('?')
    const colonIdx = scope.indexOf(':')

    const resourceEnd = minIdx(paramIdx, colonIdx)

    const resource = (
      resourceEnd !== -1 ? scope.slice(0, resourceEnd) : scope
    ) as R
    const positional =
      colonIdx !== -1
        ? decodeURIComponent(
            paramIdx === -1
              ? scope.slice(colonIdx + 1)
              : scope.slice(colonIdx + 1, paramIdx),
          )
        : undefined // None
    const params =
      paramIdx !== -1 && paramIdx < scope.length - 1
        ? // There is a (non-empty) query string, parse it
          new URLSearchParams(scope.slice(paramIdx + 1))
        : undefined

    return new ParsedResourceScope(resource, positional, params)
  }
}

const minIdx = (a: number, b: number): number =>
  a === -1 ? b : b === -1 ? a : Math.min(a, b)

/**
 * Format a scope string for a resource with parameters.
 */
export function formatScope<
  P extends Record<string, undefined | string | NeRoArray<string>>,
>(resource: string, params: P, positionalName?: keyof P) {
  let positional: string | undefined = undefined
  const queryParams = new URLSearchParams()

  for (const key in params) {
    const value = params[key]
    if (value === undefined) continue

    if (typeof value === 'string') {
      if (key === positionalName) {
        positional = value
      } else {
        queryParams.append(key, value)
      }
    } else {
      // value is "readonly string[]"
      if (value.length === 0) {
        // Because some scope default to "*" (allow everything) when a parameter
        // is not specified, let's be safe.
        throw new Error(
          `Invalid scope: parameter "${key}" cannot be an empty array`,
        )
      } else if (value.length === 1 && key === positionalName) {
        positional = value[0]!
      } else {
        for (const v of value) queryParams.append(key, v)
      }
    }
  }

  const query = queryParams.size ? `?${queryParams.toString()}` : ''

  return positional != null
    ? `${resource}:${encodeURIComponent(positional)}${query}`
    : `${resource}${query}`
}
