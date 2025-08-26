import { minIdx } from './lib/util.js'
import type { LexPermission } from './types.js'

export type ParamValue = string | number | boolean

export type NeArray<T> = [T, ...T[]]

/**
 * Non-empty readonly array
 */
export type NeRoArray<T> = readonly [T, ...T[]]

export type ScopeStringFor<P extends string> =
  | P
  | `${P}:${string}`
  | `${P}?${string}`

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
  } else if (value.length < prefix.length) {
    // No match possible
    return false
  } else {
    // value and prefix have the same length
    return value === prefix
  }
}

/**
 * Abstract interface that allows parsing various syntaxes into permission
 * representations.
 */
export interface ScopeSyntax {
  readonly prefix: string
  readonly positional?: ParamValue
  keys(): Iterable<string>
  getSingle(key: string): ParamValue | null | undefined
  getMulti(key: string): ParamValue[] | null | undefined
}

/**
 * Translates a scope string into a {@link ScopeSyntax}.
 */
export class ScopeStringSyntax implements ScopeSyntax {
  constructor(
    readonly prefix: string,
    readonly positional?: string,
    readonly params?: Readonly<URLSearchParams>,
  ) {}

  *keys(): Iterable<string> {
    const { params } = this
    if (params) yield* params.keys()
  }

  getSingle(key: string) {
    const { params } = this
    if (!params?.has(key)) return undefined
    const value = params.getAll(key)
    if (value.length > 1) return null
    return value[0]!
  }

  getMulti(key: string) {
    const { params } = this
    if (!params?.has(key)) return undefined
    return params.getAll(key)
  }

  toString() {
    let scope = this.prefix

    const { positional, params } = this
    if (positional !== undefined) {
      scope += `:${normalizeURIComponent(encodeURIComponent(positional))}`
    }

    if (params?.size) {
      scope += `?${normalizeURIComponent(params.toString())}`
    }

    return scope
  }

  static fromString(scopeValue: string) {
    const paramIdx = scopeValue.indexOf('?')
    const colonIdx = scopeValue.indexOf(':')
    const prefixEnd = minIdx(paramIdx, colonIdx)

    const prefix =
      prefixEnd !== -1 ? scopeValue.slice(0, prefixEnd) : scopeValue

    const positional =
      colonIdx !== -1
        ? // There is a positional parameter, extract it
          paramIdx === -1
          ? decodeURIComponent(scopeValue.slice(colonIdx + 1))
          : colonIdx < paramIdx
            ? decodeURIComponent(scopeValue.slice(colonIdx + 1, paramIdx))
            : undefined
        : undefined

    const params =
      // Parse the query string if present and non empty
      paramIdx !== -1 && paramIdx < scopeValue.length - 1
        ? new URLSearchParams(scopeValue.slice(paramIdx + 1))
        : undefined

    return new ScopeStringSyntax(prefix, positional, params)
  }
}

/**
 * Translates a {@link LexPermission} into a {@link ScopeSyntax}.
 */
export class LexPermissionSyntax implements ScopeSyntax {
  constructor(readonly lexPermission: Readonly<LexPermission>) {}

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

/**
 * Set of characters that are allowed in scope components without encoding. This
 * is used to normalize scope components.
 */
const ALLOWED_SCOPE_CHARS = new Set(
  // @NOTE This list must not contain "?" or "&" as it would interfere with
  // query string parsing.
  [':', '/', '+', ',', '@', '%'],
)

const NORMALIZABLE_CHARS_MAP = new Map(
  Array.from(
    ALLOWED_SCOPE_CHARS,
    (c) => [encodeURIComponent(c), c] as const,
  ).filter(
    ([encoded, c]) =>
      // Make sure that any char added to ALLOWED_SCOPE_CHARS that is a char
      // that indeed needs encoding. Also, the normalizeURIComponent only
      // supports three-character percent-encoded sequences.
      encoded !== c && encoded.length === 3 && encoded.startsWith('%'),
  ),
)

/**
 * Assumes a properly url-encoded string.
 */
function normalizeURIComponent(value: string): string {
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
