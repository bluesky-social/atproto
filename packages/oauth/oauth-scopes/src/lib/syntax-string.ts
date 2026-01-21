import { ScopeStringFor, ScopeSyntax } from './syntax.js'
import { minIdx } from './util.js'

/**
 * Translates a scope string into a {@link ScopeSyntax}.
 */
export class ScopeStringSyntax<P extends string> implements ScopeSyntax<P> {
  constructor(
    readonly prefix: P,
    readonly positional?: string,
    readonly params?: Readonly<URLSearchParams>,
  ) {}

  *keys() {
    if (this.params) yield* this.params.keys()
  }

  getSingle(key: string) {
    if (!this.params?.has(key)) return undefined
    const value = this.params.getAll(key)
    if (value.length > 1) return null
    return value[0]!
  }

  getMulti(key: string) {
    if (!this.params?.has(key)) return undefined
    return this.params.getAll(key)
  }

  toString() {
    let scope: string = this.prefix

    if (this.positional !== undefined) {
      scope += `:${normalizeURIComponent(encodeURIComponent(this.positional))}`
    }

    if (this.params?.size) {
      scope += `?${normalizeURIComponent(this.params.toString())}`
    }

    return scope as ScopeStringFor<P>
  }

  static fromString<P extends string>(
    scopeValue: ScopeStringFor<P>,
  ): ScopeStringSyntax<P> {
    const paramIdx = scopeValue.indexOf('?')
    const colonIdx = scopeValue.indexOf(':')
    const prefixEnd = minIdx(paramIdx, colonIdx)

    // No param or positional
    if (prefixEnd === -1) {
      return new ScopeStringSyntax(scopeValue as P)
    }

    const prefix = scopeValue.slice(0, prefixEnd) as P

    // Parse the positional parameter if present
    const positional =
      colonIdx !== -1
        ? paramIdx === -1
          ? decodeURIComponent(scopeValue.slice(colonIdx + 1))
          : colonIdx < paramIdx
            ? decodeURIComponent(scopeValue.slice(colonIdx + 1, paramIdx))
            : undefined
        : undefined

    // Parse the query string if present and non empty
    const params =
      paramIdx !== -1 && paramIdx < scopeValue.length - 1
        ? new URLSearchParams(scopeValue.slice(paramIdx + 1))
        : undefined

    return new ScopeStringSyntax(prefix, positional, params)
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
