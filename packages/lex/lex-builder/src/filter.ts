/**
 * Options for building a filter function to include/exclude lexicon documents.
 */
export type BuildFilterOptions = {
  /**
   * Pattern(s) for lexicon NSIDs to include.
   *
   * Supports glob patterns with `*` as a wildcard that matches one or more
   * characters. If not specified, all lexicons are included by default.
   *
   * @example
   * ```ts
   * { include: 'app.bsky.*' }           // Include all app.bsky lexicons
   * { include: ['com.atproto.*', 'app.bsky.*'] }  // Include multiple patterns
   * ```
   */
  include?: string | string[]
  /**
   * Pattern(s) for lexicon NSIDs to exclude.
   *
   * Supports glob patterns with `*` as a wildcard. Exclusions are applied
   * after inclusions.
   *
   * @example
   * ```ts
   * { exclude: '*.internal.*' }         // Exclude internal lexicons
   * { exclude: ['*.test', '*.mock'] }   // Exclude test and mock lexicons
   * ```
   */
  exclude?: string | string[]
}

/**
 * A function that tests whether a lexicon NSID should be included.
 *
 * @param input - The lexicon NSID to test
 * @returns `true` if the NSID passes the filter, `false` otherwise
 */
export type Filter = (input: string) => boolean

/**
 * Builds a filter function from include/exclude patterns.
 *
 * The returned filter returns `true` for NSIDs that match any include pattern
 * (or all NSIDs if no include patterns are specified) AND do not match any
 * exclude pattern.
 *
 * @param options - The filter options containing include/exclude patterns
 * @returns A filter function that can be applied to lexicon NSIDs
 *
 * @example
 * ```ts
 * const filter = buildFilter({
 *   include: 'app.bsky.*',
 *   exclude: '*.internal.*',
 * })
 *
 * filter('app.bsky.feed.post')     // true
 * filter('app.bsky.internal.foo')  // false
 * filter('com.atproto.repo')       // false (not included)
 * ```
 */
export function buildFilter(options: BuildFilterOptions): Filter {
  const include = createMatcher(options.include, () => true)
  const exclude = createMatcher(options.exclude, () => false)

  return (id) => include(id) && !exclude(id)
}

function createMatcher(
  pattern: undefined | string | string[],
  fallback: Filter,
): Filter {
  if (!pattern?.length) {
    return fallback
  } else if (Array.isArray(pattern)) {
    return pattern.map(buildMatcher).reduce(combineFilters)
  } else {
    return buildMatcher(pattern)
  }
}

function combineFilters(a: Filter, b: Filter): Filter {
  return (input: string) => a(input) || b(input)
}

function buildMatcher(pattern: string): Filter {
  if (pattern.includes('*')) {
    const regex = new RegExp(
      `^${pattern.replaceAll('.', '\\.').replaceAll('*', '.+')}$`,
    )
    return (input: string) => regex.test(input)
  }

  return (input: string) => pattern === input
}
