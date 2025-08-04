import { minIdx, toRecord } from './lib/util'

export type NeArray<T> = [T, ...T[]]

/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

export type ScopeForResource<R extends string> =
  | R
  | `${R}:${string}`
  | `${R}?${string}`

export type ResourceSyntaxJson<R extends string = string> = {
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
export class ResourceSyntax<R extends string = string> {
  constructor(
    public readonly resource: R,
    public readonly positional?: string,
    public readonly params?: Readonly<URLSearchParams>,
  ) {}

  is<T extends string>(resource: T): this is ResourceSyntax<T> {
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
  getMulti(name: string, isPositional?: false): NeRoArray<string> | undefined
  getMulti(
    name: string,
    isPositional: boolean, // Only if this arg is true, will this method return null
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

  toString(): ScopeForResource<R> {
    return encodeScope(this.resource, this.positional, this.params)
  }

  toJSON(): ResourceSyntaxJson<R> {
    return {
      resource: this.resource,
      positional: this.positional,
      params: this.params?.size ? toRecord(this.params) : undefined,
    }
  }

  static fromString<R extends string>(
    scope: R | `${R}:${string}` | `${R}?${string}`,
  ): ResourceSyntax<R> {
    const paramIdx = scope.indexOf('?')
    const colonIdx = scope.indexOf(':')

    const resourceEnd = minIdx(paramIdx, colonIdx)

    const resource = (
      resourceEnd !== -1 ? scope.slice(0, resourceEnd) : scope
    ) as R

    const positional =
      colonIdx !== -1
        ? // There is a positional parameter, extract it
          paramIdx === -1
          ? decodeURIComponent(scope.slice(colonIdx + 1))
          : colonIdx < paramIdx
            ? decodeURIComponent(scope.slice(colonIdx + 1, paramIdx))
            : undefined
        : undefined

    const params =
      paramIdx !== -1 // There is a query string
        ? paramIdx === scope.length - 1
          ? undefined // The query string is empty
          : new URLSearchParams(scope.slice(paramIdx + 1))
        : undefined

    return new ResourceSyntax(resource, positional, params)
  }
}

/**
 * Format a scope string for a resource with parameters
 * as a positional parameter, if possible (if it has only one value).
 * @param resource - The resource name (e.g. `rpc`, `repo`, etc.)
 * @param inputParams - The list of parameters.
 * @param positionalName - The name of the parameter that should be used as
 * positional parameter.
 */
export function formatScope<R extends string>(
  resource: R,
  inputParams: Iterable<
    [name: string, value: undefined | string | NeRoArray<string>]
  >,
  positionalName?: string,
): ScopeForResource<R> {
  const queryParams = new URLSearchParams()

  let positionalValue: string | undefined = undefined

  for (const [name, value] of inputParams) {
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

  return encodeScope(resource, positionalValue, queryParams)
}

export function encodeScope<R extends string>(
  resource: R,
  positional?: string,
  params?: Readonly<URLSearchParams>,
): ScopeForResource<R> {
  let scope: string = resource

  if (positional !== undefined) {
    scope += `:${encodeScopeComponent(positional)}`
  }

  if (params?.size) {
    scope += `?${normalizeScopeComponent(params.toString())}`
  }

  return scope as ScopeForResource<R>
}

/**
 * Set of characters that are allowed in scope components without encoding. This
 * is used to normalize scope components.
 */
export const ALLOWED_SCOPE_CHARS = new Set(
  // @NOTE This list must not contain "?" or "&" as it would interfere with
  // query string parsing.
  [':', '/', '+', ',', '@', '%'],
)

export function encodeScopeComponent(value: string): string {
  return normalizeScopeComponent(encodeURIComponent(value))
}

const NORMALIZABLE_CHARS_MAP = new Map(
  Array.from(
    ALLOWED_SCOPE_CHARS,
    (c) => [encodeURIComponent(c), c] as const,
  ).filter(
    ([encoded, c]) =>
      // Make sure that any char added to ALLOWED_SCOPE_CHARS that is a char
      // that indeed needs encoding. Also, the normalizeScopeComponent only
      // supports three-character percent-encoded sequences.
      encoded !== c && encoded.length === 3 && encoded.startsWith('%'),
  ),
)

/**
 * Assumes a properly url-encoded string.
 */
export function normalizeScopeComponent(value: string): string {
  // No need to read the last two characters since percent encoded characters
  // are always three characters long.
  let end = value.length - 2

  for (let i = 0; i < end; i++) {
    // Check if the character is a percent-encoded character
    if (value.charCodeAt(i) === 0x25 /* % */) {
      // Read the next encoded char. Current version only supports
      // three-character percent-encoded sequences.
      const encodedChar = value.slice(i, i + 3)

      // Check if the encoded character is in the normalization map
      const normalizedChar = NORMALIZABLE_CHARS_MAP.get(encodedChar)
      if (normalizedChar) {
        // Replace the encoded character with its normalized version
        value = `${value.slice(0, i)}${normalizedChar}${value.slice(i + encodedChar.length)}`

        // Adjust index to account for the length change
        i += normalizedChar.length - 1

        // Adjust end index since we replaced encoded char with normalized char
        end -= encodedChar.length - normalizedChar.length
      }
    }
  }

  return value
}
