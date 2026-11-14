import { AsyncLocalStorage } from 'node:async_hooks'
import type { IncomingHttpHeaders } from 'node:http'
import { isIP } from 'node:net'
import type { Interceptor } from '@connectrpc/connect'
import type express from 'express'

/**
 * Request-scoped state for forwarding the request's `x-real-ip` address to
 * the data plane. The address is only useful there for unauthenticated
 * requests, so the auth verifiers mark requests whose credentials the
 * AppView recognizes — a bearer token, or valid admin or mod-service
 * credentials. Anything else is handled anonymously and gets the address
 * forwarded.
 */
export type RealIpState = {
  ip?: string
  authenticated?: boolean
}

export const realIpStore = new AsyncLocalStorage<RealIpState>()

/**
 * Returns the address from the request's `x-real-ip` header when it is a
 * single IPv4 or IPv6 address, or undefined otherwise (missing, duplicated,
 * or malformed).
 */
export const realIpFromHeaders = (
  headers: IncomingHttpHeaders,
): string | undefined => {
  const value = headers['x-real-ip']
  // Duplicate headers arrive as an array, which is ambiguous.
  if (typeof value !== 'string') return undefined
  const ip = value.trim()
  return isIP(ip) ? ip : undefined
}

/**
 * Express middleware that exposes the request's `x-real-ip` address to the
 * data-plane client interceptor below.
 */
export const realIpMiddleware: express.RequestHandler = (req, _res, next) => {
  realIpStore.run({ ip: realIpFromHeaders(req.headers) }, () => next())
}

/**
 * Marks the current request as authenticated (user, admin, or mod-service
 * credentials). Only unauthenticated requests have their address forwarded.
 */
export const markRequestAuthenticated = (): void => {
  const state = realIpStore.getStore()
  if (state) state.authenticated = true
}

/**
 * Connect interceptor that forwards the client address to the data plane as
 * the `x-real-ip` header on unauthenticated requests. Owns the header on
 * this client: any value already present on the call is removed, so the
 * request-scoped state is the only way it gets set.
 */
export const realIpInterceptor: Interceptor = (next) => (req) => {
  const state = realIpStore.getStore()
  if (state?.ip && !state.authenticated) {
    req.header.set('x-real-ip', state.ip)
  } else {
    req.header.delete('x-real-ip')
  }
  return next(req)
}
