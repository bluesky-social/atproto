import { AtprotoDid, isAtprotoDid } from '@atproto/did'
export type { AtprotoDid, AtprotoIdentityDidMethods } from '@atproto/did'

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
