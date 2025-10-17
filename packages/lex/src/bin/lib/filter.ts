export type BuildFilterOptions = {
  include?: string | string[]
  exclude?: string | string[]
}

export type Filter = (input: string) => boolean

export function buildFilter(options: BuildFilterOptions): Filter {
  const include = options.include ? createMatcher(options.include) : () => true
  const exclude = options.exclude ? createMatcher(options.exclude) : () => false

  return (id) => include(id) && !exclude(id)
}

function createMatcher(pattern: string | string[]): Filter {
  if (Array.isArray(pattern)) {
    return pattern.map(buildMatcher).reduce((a, b) => {
      return (input) => a(input) || b(input)
    })
  } else {
    return buildMatcher(pattern)
  }
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
