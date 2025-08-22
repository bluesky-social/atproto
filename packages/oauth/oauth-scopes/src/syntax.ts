import { minIdx, sum, toRecord } from './lib/util'
import type { LexPermission } from './types'

export type ParamValue = string | number | boolean

export type NeArray<T> = [T, ...T[]]

/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

export type ResourceSyntaxFor<R extends string> =
  | R
  | `${R}:${string}`
  | `${R}?${string}`

export type ResourceSyntaxJson<R extends string = string> = {
  resource: R
  positional?: string
  params?: Record<string, undefined | ParamValue | NeRoArray<ParamValue>>
}

/**
 * Allows to quickly check if a scope is for a specific resource.
 */
export function isResourceSyntaxFor<R extends string>(
  scopeValue: string,
  resource: R,
): scopeValue is ResourceSyntaxFor<R> {
  if (!scopeValue.startsWith(resource)) return false
  if (scopeValue.length === resource.length) return true

  const nextCharCode = scopeValue.charCodeAt(resource.length)
  return nextCharCode === 0x3a /* : */ || nextCharCode === 0x3f /* ? */
}

/**
 * Allows unifying various permission parameters into a single interface. This
 * interface compatible with the {@link URLSearchParams} interface, allowing url
 * params to be used "out of the box".
 */
export interface ResourceSyntaxParams
  extends Iterable<[string, ParamValue], void, unknown> {
  readonly size: number
  keys(): Iterable<string>
  has(key: string): boolean
  getAll(key: string): undefined | ParamValue[]
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
    public readonly params?: ResourceSyntaxParams,
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
  getSingle(name: string, isPositional = false): ParamValue | undefined | null {
    const { params } = this
    const values =
      params != null && params.has(name) ? params.getAll(name) : undefined

    if (!values?.length) {
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
  ): NeRoArray<ParamValue> | undefined
  getMulti(
    name: string,
    isPositional: boolean, // Only if this arg is true, will this method return null
  ): NeRoArray<ParamValue> | null | undefined
  getMulti(
    name: string,
    isPositional = false,
  ): NeRoArray<ParamValue> | null | undefined {
    const { params } = this
    const values =
      params != null && params.has(name) ? params.getAll(name) : undefined

    if (!values?.length) {
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

    return values as [string, ...string[]]
  }

  toString(): ResourceSyntaxFor<R> {
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

  static fromLex(lexPermission: LexPermission): ResourceSyntax {
    const params = new LexPermissionParamsGetter(lexPermission)
    return new ResourceSyntax(lexPermission.resource, undefined, params)
  }
}

/**
 * Translates a {@link LexPermission} into a {@link ResourceSyntaxParams} to be used
 * by the {@link ResourceSyntax}.
 */
export class LexPermissionParamsGetter implements ResourceSyntaxParams {
  constructor(protected readonly lexPermission: LexPermission) {}

  get size() {
    return Object.values(this.lexPermission).map(paramValueSize).reduce(sum, 0)
  }

  get(key: string) {
    if (!Object.hasOwn(this.lexPermission, key)) return undefined
    return this.lexPermission[key]
  }

  *keys(): Generator<string, void, unknown> {
    for (const [key, value] of Object.entries(this.lexPermission)) {
      if (key === 'type') continue
      if (key === 'resource') continue
      if (value === undefined) continue
      yield key
    }
  }

  *entries(): Generator<[string, ParamValue], void, unknown> {
    for (const [key, value] of Object.entries(this.lexPermission)) {
      if (key === 'type') continue
      if (key === 'resource') continue
      if (value === undefined) continue
      if (Array.isArray(value)) {
        for (const item of value) yield [key, item]
      } else {
        yield [key, value]
      }
    }
  }

  has(key: string) {
    return this.get(key) !== undefined
  }

  getAll(key: string): undefined | ParamValue[] {
    const value = this.get(key)
    if (value === undefined) return undefined
    return Array.isArray(value) ? value : [value]
  }

  toString() {
    const qs = new URLSearchParams(Array.from(this, stringifyEntryItems))
    return `[LexPermission ${this.lexPermission.resource}${qs ? `?${qs}` : ''}]`
  }

  toJSON(): LexPermission {
    return this.lexPermission
  }

  [Symbol.iterator](): Iterator<[string, ParamValue]> {
    return this.entries()
  }
}

function paramValueSize(v?: ParamValue | Array<ParamValue>): number {
  if (v === undefined) return 0
  if (Array.isArray(v)) return v.length
  return 1
}

function stringifyEntryItems([key, value]: [unknown, unknown]) {
  return [String(key), String(value)]
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
    [name: string, value: undefined | ParamValue | NeRoArray<ParamValue>]
  >,
  positionalName?: string,
): ResourceSyntaxFor<R> {
  const queryParams = new URLSearchParams()

  let positionalValue: string | undefined = undefined

  for (const [name, value] of inputParams) {
    if (value === undefined) continue

    const setPositional =
      name === positionalName && positionalValue === undefined

    if (typeof value !== 'object') {
      if (setPositional) {
        positionalValue = String(value)
      } else {
        queryParams.append(name, String(value))
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
        positionalValue = String(value[0]!)
      } else {
        for (const v of value) {
          queryParams.append(name, String(v))
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
  params?: ResourceSyntaxParams,
): ResourceSyntaxFor<R> {
  let scope: string = resource

  if (positional !== undefined) {
    scope += `:${encodeScopeComponent(positional)}`
  }

  if (params?.size) {
    const queryString =
      params instanceof URLSearchParams
        ? normalizeScopeComponent(params.toString())
        : Array.from(params, encodeParamEntry).join('&')
    scope += `?${queryString}`
  }

  return scope as ResourceSyntaxFor<R>
}

function encodeParamEntry([key, value]: [string, ParamValue]): string {
  return `${encodeScopeComponent(key)}=${encodeScopeComponent(String(value))}`
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
