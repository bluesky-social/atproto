import { isLoopbackHost } from '@atproto/oauth-types'

export type Simplify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>
export type TupleUnion<U extends string, R extends any[] = []> = {
  [S in U]: Exclude<U, S> extends never
    ? [...R, S]
    : TupleUnion<Exclude<U, S>, [...R, S]>
}[U]

/**
 * @example
 * ```ts
 * const clientId = buildLoopbackClientId(window.location)
 * ```
 */
export function buildLoopbackClientId(
  location: {
    hostname: string
    pathname: string
    port: string
  },
  localhost = '127.0.0.1',
): string {
  if (!isLoopbackHost(location.hostname)) {
    throw new TypeError(`Expected a loopback host, got ${location.hostname}`)
  }

  const redirectUri = `http://${location.hostname === 'localhost' ? localhost : location.hostname}${location.port && !location.port.startsWith(':') ? `:${location.port}` : location.port}${location.pathname}`

  return `http://localhost${
    location.pathname === '/' ? '' : location.pathname
  }?redirect_uri=${encodeURIComponent(redirectUri)}`
}
