import { type AtprotoDid, isAtprotoDid } from '@atproto/did'
export type { AtprotoDid, AtprotoIdentityDidMethods } from '@atproto/did'

/**
 * Context passed to a {@link HandleResolverErrorHandler} alongside the raw
 * error, identifying which resolution strategy produced it.
 */
export type HandleResolverErrorContext = {
  /**
   * Which resolver raised the error. Only the well-known HTTP resolver reports
   * through `onError`: it is the only strategy that swallows failures (returning
   * `null`), so it is the only one whose errors would otherwise be invisible.
   * The DNS and XRPC resolvers throw on unexpected errors, so their failures
   * already surface to the caller.
   */
  resolver: 'well-known'
  /** The handle being resolved when the error occurred. */
  handle: string
}

/**
 * Observability hook invoked when a resolver hits a non-abort error during
 * handle resolution. The resolver still returns `null` per its contract; this
 * only exposes the cause (SSRF blocks, 5xx upstream errors, redirects, network
 * errors, etc.) for logging, telemetry, or surfacing a specific failure mode to
 * end users.
 */
export type HandleResolverErrorHandler = (
  err: unknown,
  context: HandleResolverErrorContext,
) => void

export type ResolveHandleOptions = {
  signal?: AbortSignal
  noCache?: boolean
}

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export type ResolvedHandle = null | AtprotoDid

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export function isResolvedHandle(value: unknown): value is ResolvedHandle {
  return value === null || isAtprotoDid(value)
}

export function asResolvedHandle<T>(value: T): null | (T & AtprotoDid) {
  return isResolvedHandle(value) ? value : null
}

export interface HandleResolver {
  /**
   * @returns the DID that corresponds to the given handle, or `null` if no DID
   * is found. `null` should only be returned if no unexpected behavior occurred
   * during the resolution process.
   * @throws Error if the resolution method fails due to an unexpected error, or
   * if the resolution is aborted ({@link ResolveHandleOptions}).
   */
  resolve(
    handle: string,
    options?: ResolveHandleOptions,
  ): Promise<ResolvedHandle>
}
