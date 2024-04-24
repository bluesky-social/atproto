export type PathMatcher<P extends Params> = (pathname: string) => P | undefined

type StringPath<P extends Params> = string extends keyof P
  ? `/${string}`
  : keyof P extends never
    ? `/${string}` | ``
    : {
        [K in keyof P]: K extends string
          ?
              | `${`/:${K}` | `/${string}/:${K}`}${StringPath<Omit<P, K>>}`
              | `${StringPath<Omit<P, K>>}${`/:${K}` | `/:${K}/${string}`}`
          : never
      }[keyof P]

export type Path<P extends Params> =
  | string
  | StringPath<P>
  | RegExp
  | PathMatcher<P>
export type Params = Record<string, undefined | string>

export function createPathMatcher<P extends Params = Params>(
  refPath: Path<P>,
): PathMatcher<P> {
  if (typeof refPath === 'string') {
    // Create a path matcher for a path with parameters (like /foo/:fooId/bar/:barId).
    if (refPath.includes('/:')) {
      const refParts = refPath
        .slice(1)
        .split('/')
        .map((part, i) => [part, i] as const)
      const refPartsLength = refParts.length

      const staticParts = refParts.filter(([p]) => !p.startsWith(':'))
      const paramParts = refParts
        // Extract parameters, ignoring those with no name (like /foo/:/bar).
        .filter(([p]) => p.startsWith(':') && p.length > 1)
        .map(([p, i]) => [p.slice(1), i] as const)

      return (reqPath: string) => {
        const reqParts = reqPath.slice(1).split('/')

        if (reqParts.length !== refPartsLength) return undefined

        // Make sure all static parts match.
        for (let i = 0; i < staticParts.length; i++) {
          const value = staticParts[i]![0]
          const idx = staticParts[i]![1]

          if (value !== reqParts[idx]) return undefined
        }

        // Then extract the parameters.
        const params: Record<string, string> = {}
        for (let i = 0; i < paramParts.length; i++) {
          const name = paramParts[i]![0]
          const idx = paramParts[i]![1]

          const value = reqParts[idx]

          // Empty parameter values are not allowed.
          if (!value) return undefined

          params[name] = value
        }

        return params as P
      }
    }

    return (reqPath: string) => (reqPath === refPath ? ({} as P) : undefined)
  }

  if (refPath instanceof RegExp) {
    return (reqPath: string) => {
      const match = reqPath.match(refPath)
      return match ? ((match.groups || {}) as P) : undefined
    }
  }

  return refPath
}
