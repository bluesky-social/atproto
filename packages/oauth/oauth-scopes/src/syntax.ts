import { minIdx } from './lib/util.js'
import type { LexPermission } from './types.js'

export type ParamValue = string | number | boolean

export type NeArray<T> = [T, ...T[]]

/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

export type ScopeSyntaxFor<P extends string> =
  | P
  | `${P}:${string}`
  | `${P}?${string}`

/**
 * Allows to quickly check if a scope is for a specific resource.
 */
export function isScopeSyntaxFor<P extends string>(
  scopeValue: string,
  resource: P,
): scopeValue is ScopeSyntaxFor<P> {
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
export interface ScopeSyntaxReader {
  readonly prefix: string
  readonly positional?: string
  keys(): Iterable<string>
  getSingle(key: string): ParamValue | null | undefined
  getMulti(key: string): ParamValue[] | null | undefined
}

/**
 * Utility class to parse and interpret the resource scope syntax used in
 * atproto oauth scopes.
 * The syntax is defined as follows:
 * ```nbf
 * scope := prefix [':' positional] ['?' params]
 * params := param ['&' param]*
 * param := name '=' value
 * ```
 * Where "positional" can be used as short-hand (i.e. not used in combination
 * with) for a specific parameter.
 */
export class ScopeSyntax {
  constructor(public readonly reader: ScopeSyntaxReader) {}

  get prefix() {
    return this.reader.prefix
  }

  get positional() {
    return this.reader.positional
  }

  is(prefix: string): boolean {
    return this.prefix === prefix
  }

  containsParamsOtherThan(allowedParam: readonly string[]): boolean {
    for (const key of this.reader.keys()) {
      if (!allowedParam.includes(key)) return true
    }

    return false
  }

  /**
   * Retrieve the value of a parameter that only allows a single value. If the
   * parameter is not found, it will return `undefined`. If the syntax is
   * incorrect (i.e. the parameter has multiple values), it will return `null`.
   */
  getSingle(name: string, isPositional = false): ParamValue | undefined | null {
    const value = this.reader.getSingle(name)

    if (value === null) {
      return null // Got multiple values
    }

    if (value === undefined) {
      // No named parameter found, use positional parameter
      if (isPositional) return this.positional

      return undefined
    }

    if (isPositional && this.positional !== undefined) {
      // Positional parameter cannot be used with named parameters
      return null
    }

    return value
  }

  /**
   * Retrieve the values of a parameter that allows multiple values. If the
   * parameter is not found, it will return `undefined`. If the syntax is
   * incorrect (i.e. there is bot a positional and named parameter), it will
   * return `null`.
   */
  getMulti(
    name: string,
    isPositional = false,
  ): NeRoArray<ParamValue> | null | undefined {
    const values = this.reader.getMulti(name)

    if (values === null) {
      return null // Got single value
    }

    if (values === undefined) {
      // No named parameter found, use positional parameter

      if (isPositional && this.positional !== undefined) {
        return [this.positional]
      }

      return undefined
    }

    if (values.length === 0) {
      return null // Empty array are not allowed
    }

    if (isPositional && this.positional !== undefined) {
      // @NOTE we *could* return [this.positional, ...values] here but the
      // atproto scope syntax forbids use of both positional and named
      // parameters.
      return null
    }

    return values as NeArray<ParamValue>
  }

  static fromString(scope: string): ScopeSyntax {
    const reader = new ScopeValueStringReader(scope)
    return new ScopeSyntax(reader)
  }

  static fromLex(lexPermission: LexPermission): ScopeSyntax {
    const reader = new LexPermissionReader(lexPermission)
    return new ScopeSyntax(reader)
  }
}

export class ScopeValueStringReader
  extends URLSearchParams
  implements ScopeSyntaxReader
{
  readonly prefix: string
  readonly positional?: string

  constructor(value: string) {
    const paramIdx = value.indexOf('?')
    const colonIdx = value.indexOf(':')
    const prefixEnd = minIdx(paramIdx, colonIdx)

    const queryString =
      paramIdx !== -1 // There is a query string
        ? paramIdx === value.length - 1
          ? undefined // The query string is empty
          : value.slice(paramIdx + 1)
        : undefined

    super(queryString)

    this.prefix = prefixEnd !== -1 ? value.slice(0, prefixEnd) : value
    this.positional =
      colonIdx !== -1
        ? // There is a positional parameter, extract it
          paramIdx === -1
          ? decodeURIComponent(value.slice(colonIdx + 1))
          : colonIdx < paramIdx
            ? decodeURIComponent(value.slice(colonIdx + 1, paramIdx))
            : undefined
        : undefined
  }

  getSingle(key: string) {
    if (!this.has(key)) return undefined
    const value = this.getAll(key)
    if (value.length > 1) return null
    return value[0]!
  }

  getMulti(key: string) {
    if (!this.has(key)) return undefined
    return this.getAll(key)
  }
}

/**
 * Translates a {@link LexPermission} into a {@link ScopeSyntaxParams} to be used
 * by the {@link ScopeSyntax}.
 */
export class LexPermissionReader implements ScopeSyntaxReader {
  constructor(protected readonly lexPermission: LexPermission) {}

  get prefix() {
    return this.lexPermission.resource
  }

  get positional() {
    return undefined
  }

  get(key: string) {
    // Ignore reserved keywords
    if (key === 'type') return undefined
    if (key === 'resource') return undefined

    // Ignore inherited properties (toString(), etc.)
    if (!Object.hasOwn(this.lexPermission, key)) return undefined

    return this.lexPermission[key]
  }

  *keys(): Generator<string, void, unknown> {
    for (const key of Object.keys(this.lexPermission)) {
      if (this.get(key) !== undefined) yield key
    }
  }

  getSingle(key: string) {
    const value = this.get(key)
    if (Array.isArray(value)) return null
    return value
  }

  getMulti(key: string) {
    const value = this.get(key)
    if (value === undefined) return undefined
    if (!Array.isArray(value)) return null
    return value
  }
}

export function encodeScope<P extends string>(
  resource: P,
  positional?: string,
  params?: URLSearchParams,
): ScopeSyntaxFor<P> {
  let scope: string = resource

  if (positional !== undefined) {
    scope += `:${encodeScopeComponent(positional)}`
  }

  if (params?.size) {
    scope += `?${normalizeScopeComponent(params.toString())}`
  }

  return scope as ScopeSyntaxFor<P>
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
