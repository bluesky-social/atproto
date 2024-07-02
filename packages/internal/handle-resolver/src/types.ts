import { Did, isAtprotoDidWeb, isDidPlc } from '@atproto/did'

export type ResolveHandleOptions = {
  signal?: AbortSignal
  noCache?: boolean
}

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export type ResolvedHandle = null | Did<'plc' | 'web'>

export { type Did }

/**
 * @see {@link https://atproto.com/specs/did#blessed-did-methods}
 */
export function isResolvedHandle<T = unknown>(
  value: T,
): value is T & ResolvedHandle {
  return value === null || isDidPlc(value) || isAtprotoDidWeb(value)
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
