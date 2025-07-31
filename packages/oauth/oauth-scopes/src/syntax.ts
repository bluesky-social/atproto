/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

export type ScopeForResource<R extends string> =
  | R
  | `${R}:${string}`
  | `${R}?${string}`

export type ParsedResourceScopeJson<R extends string = string> = {
  resource: R
  positional?: string
  params?: Record<string, undefined | string | NeRoArray<string>>
}

/**
 * Allows to quickly check if a scope is for a specific resource.
 */
export function isScopeForResource<R extends string>(
  scope: string,
  resource: R,
): scope is ScopeForResource<R> {
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

  containsParamsOtherThan(allowedParam: NeRoArray<string>): boolean {
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
  getMulti(name: string, isPositional?: false): NeRoArray<string> | undefined
  getMulti(
    name: string,
    isPositional: true, // Only if this arg is true, will this method return null
  ): NeRoArray<string> | null | undefined
  getMulti(
    name: string,
    isPositional = false,
  ): NeRoArray<string> | null | undefined {
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

    if (this.positional !== undefined) {
      scope += `:${encodeURIComponent(this.positional)}`
    }

    if (this.params?.size) {
      scope += `?${this.params.toString()}`
    }

    return scope
  }

  toJSON(): ParsedResourceScopeJson<R> {
    return {
      resource: this.resource,
      positional: this.positional,
      params: this.params?.size ? toRecord(this.params) : undefined,
    }
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
      colonIdx !== -1 && (paramIdx === -1 || colonIdx < paramIdx)
        ? // There is a positional parameter, extract it
          decodeURIComponent(
            paramIdx === -1
              ? scope.slice(colonIdx + 1)
              : scope.slice(colonIdx + 1, paramIdx),
          )
        : undefined
    const params =
      paramIdx !== -1 && paramIdx < scope.length - 1
        ? // There is a (non-empty) query string, parse it
          new URLSearchParams(scope.slice(paramIdx + 1))
        : undefined

    return new ParsedResourceScope(resource, positional, params)
  }
}

const minIdx = (a: number, b: number): number => {
  if (a === -1) return b
  if (b === -1) return a
  return Math.min(a, b)
}

/**
 * Format a scope string for a resource with parameters
 * as a positional parameter, if possible (if it has only one value).
 * @param resource - The resource name (e.g. `rpc`, `repo`, etc.)
 * @param params - The list of parameters.
 * @param positionalName - The name of the parameter that should be used as
 * positional parameter.
 */
export function formatScope<R extends string>(
  resource: R,
  params: Iterable<
    [name: string, value: undefined | string | NeRoArray<string>]
  >,
  positionalName?: string,
): ScopeForResource<R> {
  const queryParams = new URLSearchParams()

  let positionalValue: string | undefined = undefined

  for (const [name, value] of params) {
    if (value === undefined) continue

    const setPositional =
      name === positionalName && positionalValue === undefined

    if (typeof value === 'string') {
      if (setPositional) {
        positionalValue = value
      } else {
        queryParams.append(name, value)
      }
    } else {
      // value is "readonly [string, ...string[]]"
      if (value.length === 0) {
        // This should never happen (because "value" is supposed to be a
        // non-empty array). Because some scope default to "*" (allow
        // everything) when a parameter is not specified, we'd rather be safe
        // here.
        throw new Error(
          `Invalid scope: parameter "${name}" cannot be an empty array`,
        )
      } else if (setPositional && value.length === 1) {
        positionalValue = value[0]!
      } else {
        for (const v of value) {
          queryParams.append(name, v)
        }
      }
    }
  }

  // Fool-proof: If the input iterable defines multiple times the same
  // positional parameter (name), and it ended up being used as both positional
  // and query param, move the positional value to the query params.
  if (positionalValue !== undefined && queryParams.has(positionalName!)) {
    queryParams.append(positionalName!, positionalValue)
    positionalValue = undefined
  }

  let scope: ScopeForResource<R> = resource
  if (positionalValue !== undefined) {
    scope = `${scope}:${encodeURIComponent(positionalValue)}`
  }
  if (queryParams.size > 0) {
    scope = `${scope}?${queryParams.toString()}`
  }
  return scope
}

function toRecord(
  iterable: Iterable<[key: string, value: string]>,
): Record<string, string | [string, ...string[]]> {
  const record: Record<string, [string, ...string[]]> = Object.create(null)
  for (const [key, value] of iterable) {
    if (Object.hasOwn(record, key)) {
      record[key]!.push(value)
    } else {
      record[key] = [value]
    }
  }
  return record
}
