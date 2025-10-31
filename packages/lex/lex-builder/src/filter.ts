export type BuildFilterOptions = {
  include?: string | string[]
  exclude?: string | string[]
}

export type Filter = (input: string) => boolean

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
