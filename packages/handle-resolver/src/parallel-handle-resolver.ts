import {
  HandleResolveOptions,
  HandleResolveValue,
  HandleResolver,
} from './handle-resolver.js'

export class ParallelHandleResolver implements HandleResolver {
  constructor(protected readonly resolvers: readonly HandleResolver[]) {
    if (!resolvers.length) {
      throw new TypeError('At least one resolver is required')
    }
  }

  public async resolve(
    handle: string,
    options?: HandleResolveOptions,
  ): Promise<HandleResolveValue> {
    const controller = new AbortController()

    options?.signal?.addEventListener('abort', () => controller.abort(), {
      signal: controller.signal,
    })

    try {
      return await new Promise((resolve, _reject) => {
        Promise.allSettled(
          this.resolvers.map((resolver) =>
            resolver
              .resolve(handle, { ...options, signal: controller.signal })
              .then(resolve),
          ),
        ).then(() =>
          // If no resolver was able to resolve the handle, assume there is no
          // DID corresponding to the handle.
          resolve(null),
        )
      })
    } finally {
      // Abort all pending requests & remove event listener on incoming signal
      controller.abort()
    }
  }
}
