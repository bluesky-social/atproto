import { Did, isDid } from '@atproto/did'

export type ResolveOptions = {
  signal?: AbortSignal
  noCache?: boolean
}
export type ResolvedHandle = null | Did

export { type Did }
export { isDid }
export function isResolvedHandle<T = unknown>(
  value: T,
): value is T & ResolvedHandle {
  return value === null || isDid(value)
}

export interface HandleResolver {
  /**
   * @returns the DID that corresponds to the given handle, or `null` if no DID
   * is found. `null` should only be returned if no unexpected behavior occurred
   * during the resolution process.
   * @throws Error if the resolution method fails due to an unexpected error, or
   * if the resolution is aborted ({@link ResolveOptions.signal}).
   */
  resolve(handle: string, options?: ResolveOptions): Promise<ResolvedHandle>
}
