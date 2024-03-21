import {
  HandleResolveOptions,
  HandleResolveValue,
  HandleResolver,
} from './handle-resolver.js'

export class SerialHandleResolver implements HandleResolver {
  constructor(protected readonly resolvers: readonly HandleResolver[]) {
    if (!resolvers.length) {
      throw new TypeError('At least one resolver is required')
    }
  }

  public async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<HandleResolveValue> {
    for (const resolver of this.resolvers) {
      options?.signal?.throwIfAborted()
      try {
        return await resolver.resolve(handle, options)
      } catch {
        // noop
      }
    }

    // If no resolver was able to resolve the handle, assume there is no DID
    // corresponding to the handle.
    return null
  }
}
