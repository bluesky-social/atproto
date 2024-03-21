import { GetOptions } from '@atproto/caching'
import { Did } from '@atproto/did'

export type HandleResolveOptions = GetOptions
export type HandleResolveValue = null | Did<'web' | 'plc'>

export interface HandleResolver {
  /**
   * @returns null if handle does not correspond to a DID. If the resolution method is unable to determine if the handle corresponds to a DID, it should throw an error.
   * @throws Error if the method is not able to determine if the handle corresponds to a DID, or if an error occurs during resolution.
   */
  resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<HandleResolveValue>
}
